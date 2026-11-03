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
import { dbState } from "./lib/dbStatus";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

// Resume upload dir configurable via UPLOADS_DIR (Render disk is ephemeral by
// default; mount a persistent disk or set UPLOADS_DIR to object-storage-backed
// path as needed).
export const RESUME_UPLOAD_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads", "resumes");

try {
  fs.mkdirSync(RESUME_UPLOAD_DIR, { recursive: true });
} catch {
  // Gracefully continue in read-only serverless filesystems
}

const app: Express = express();

// Security headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS: parse CORS_ORIGINS (comma-separated) into an allowlist.
// Supports credentials and the Authorization header; handles OPTIONS preflight.
const allowlist = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      // Requests with no Origin (same-origin, curl, mobile native) are allowed.
      if (!origin) {
        return cb(null, true);
      }
      if (allowlist.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
} else {
  const allowDevAuth =
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_DEV_AUTH === "true";
  if (allowDevAuth) {
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
  }
}

// Serve uploaded resume files (access-controlled in the route itself)
app.use("/uploads/resumes", express.static(RESUME_UPLOAD_DIR));

app.use("/api", router);

// Health check: always 200, db reflects live MongoDB status
app.get(["/healthz", "/health"], (_req, res) => {
  res.status(200).json({ status: "ok", db: dbState.status });
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
