import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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

import os from "os";

// Ensure the resume upload directory exists (fallback to os.tmpdir in serverless environments like Vercel)
export const RESUME_UPLOAD_DIR =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join(os.tmpdir(), "uploads", "resumes")
    : path.join(process.cwd(), "uploads", "resumes");

try {
  fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });
} catch {
  // Gracefully continue in read-only serverless filesystems
}

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
app.use(cookieParser());

// JSON + URL-encoded for standard API calls
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Clerk middleware for auth (with dev fallback if keys are placeholders)
const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY;
const clerkSecKey = process.env.CLERK_SECRET_KEY;
const isClerkConfigured =
  Boolean(clerkPubKey) &&
  !clerkPubKey?.includes("REPLACE") &&
  Boolean(clerkSecKey) &&
  !clerkSecKey?.includes("REPLACE");

if (isClerkConfigured && clerkPubKey) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        clerkPubKey,
      ),
    })),
  );
} else {
  const clerkAuthBrand = Symbol.for("@clerk/express.auth");
  logger.warn(
    "⚠️ Clerk keys not configured in .env. Running in DEV mode with guest/mock auth fallback."
  );
  app.use((req, _res, next) => {
    const userId = (req.headers["x-user-id"] as string) || "user_demo_seeker";
    const authHandler = () => ({
      tokenType: "session_token",
      sessionClaims: {},
      sessionId: "sess_demo_123",
      userId,
      actor: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      orgPermissions: null,
      factorVerificationAge: null,
      getToken: () => Promise.resolve("mock_token"),
      has: () => false,
      debug: () => ({}),
      isAuthenticated: true,
    });
    (authHandler as any)[clerkAuthBrand] = true;
    (req as any).auth = authHandler;
    next();
  });
}

// Serve uploaded resume files (access-controlled in the route itself)
app.use("/uploads/resumes", express.static(RESUME_UPLOAD_DIR));

app.use("/api", router);

// Convenience alias so both /auth/google/callback and /api/auth/google/callback resolve
app.get("/auth/google/callback", (req, res) => {
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  res.redirect(`/api/auth/google/callback${query}`);
});

export default app;
