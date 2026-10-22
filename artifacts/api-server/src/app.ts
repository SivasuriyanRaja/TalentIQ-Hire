import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

// Ensure the resume upload directory exists
export const RESUME_UPLOAD_DIR = path.join(process.cwd(), "uploads", "resumes");
fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// JSON + URL-encoded for standard API calls
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Clerk middleware for auth
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Serve uploaded resume files (access-controlled in the route itself)
app.use("/uploads/resumes", express.static(RESUME_UPLOAD_DIR));

app.use("/api", router);

export default app;
