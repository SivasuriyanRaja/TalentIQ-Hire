import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { loadEnv } from "./lib/env";
import { dbState } from "./lib/dbStatus";
import { connectDB } from "@workspace/db";

// Coalesce MONGODB_URI -> DATABASE_URL so both env validation and connectDB
// see a single canonical value. process.env is mutable at startup.
if (!process.env.DATABASE_URL && process.env.MONGODB_URI) {
  process.env.DATABASE_URL = process.env.MONGODB_URI;
}

const env = loadEnv();

async function connectWithRetry(retries = 10, delayMs = 3000): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      await connectDB();
      dbState.status = "up";
      logger.info("MongoDB connected successfully");
      return;
    } catch (err) {
      lastErr = err;
      logger.warn(
        { attempt: i + 1, retries },
        "MongoDB connect attempt failed, retrying...",
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  logger.error(
    { err: String(lastErr) },
    "MongoDB connection failed after retries",
  );
  dbState.status = "down";
}

const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT }, `Server listening on 0.0.0.0:${env.PORT}`);
});

connectWithRetry();
