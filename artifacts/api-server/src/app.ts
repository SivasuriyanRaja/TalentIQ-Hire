import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { connectDB } from "@workspace/db";
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

// Hard-fail in production unless dev auth is explicitly allowed.
const allowDevAuth =
  process.env.NODE_ENV === "development" &&
  process.env.ALLOW_DEV_AUTH === "true";
if (process.env.NODE_ENV === "production" && allowDevAuth) {
  throw new Error("ALLOW_DEV_AUTH=true is not permitted in production.");
}

const app: Express = express();

// Security headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS allowlist
const allowlist = (process.env.CORS_ALLOWLIST || "http://localhost:8081,https://talentiq-hire.onrender.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin || allowlist.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
  }),
);
app.use(cookieParser());

// JSON + URL-encoded for standard API calls
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Per-user rate limits for AI routes
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as any).resolvedUserId ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
});

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

// Clerk middleware for auth (with dev fallback gated by NODE_ENV + ALLOW_DEV_AUTH)
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
} else if (allowDevAuth) {
  logger.warn(
    "Running in DEV mode with guest/mock auth fallback (ALLOW_DEV_AUTH=true).",
  );
  const clerkAuthBrand = Symbol.for("@clerk/express.auth");
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
} else {
  throw new Error("Clerk keys not configured and ALLOW_DEV_AUTH is not enabled.");
}

// Serve uploaded resume files (access-controlled in the route itself)
app.use("/uploads/resumes", express.static(RESUME_UPLOAD_DIR));

app.use("/api", router);

// Health check with DB connectivity
app.get(["/healthz", "/health"], async (_req, res) => {
  try {
    await connectDB();
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ status: "degraded", db: "disconnected", error: String(err) });
  }
});

// Convenience alias so both /auth/google/callback and /api/auth/google/callback resolve
app.get("/auth/google/callback", (req, res) => {
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  res.redirect(`/api/auth/google/callback${query}`);
});

// If /auth/callback hits Express, safely redirect to frontend SPA
app.get("/auth/callback", (req, res) => {
  const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  const frontendUrl = process.env.FRONTEND_URL || "https://talentiq-hire.vercel.app";
  res.redirect(`${frontendUrl.replace(/\/+$/, "")}/auth/callback${query}`);
});

export default app;
