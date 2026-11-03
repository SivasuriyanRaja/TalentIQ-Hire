import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { UserProfile } from "@workspace/db";

// pino-http attaches `req.log` at runtime; declare it for typechecks
declare module "express" {
  interface Request {
    log?: {
      error(msg: string, obj?: any): void;
      warn(msg: string, obj?: any): void;
      info(msg: string, obj?: any): void;
    };
  }
}

export interface ResolvedAuth {
  userId: string;
  role: "candidate" | "recruiter";
}

const DEV_USER_ID = "user_demo_seeker";

export function getRequestUserId(req: Request): string {
  const resolved = (req as any).resolvedUserId;
  if (resolved) return resolved;
  try {
    const auth = getAuth(req);
    if (auth?.userId) return auth.userId;
  } catch {}
  return (req.headers["x-user-id"] as string) || DEV_USER_ID;
}

export async function resolveAuth(req: Request): Promise<ResolvedAuth> {
  const userId = getRequestUserId(req);

  let role: "candidate" | "recruiter" = "candidate";
  try {
    const auth = getAuth(req);
    const meta = (auth as any)?.auth?.publicMetadata ?? (auth as any)?.publicMetadata;
    if (meta?.role === "recruiter" || meta?.role === "candidate") {
      role = meta.role;
    }
  } catch {}

  if (role === "candidate") {
    try {
      const profile = await UserProfile.findOne({ userId }).select("role").lean();
      if (profile?.role === "recruiter") role = "recruiter";
    } catch {}
  }

  (req as any).resolvedUserId = userId;
  (req as any).resolvedRole = role;
  return { userId, role };
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void | Response {
  const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured =
    Boolean(clerkPubKey) && !clerkPubKey?.includes("REPLACE");
  const allowDevAuth =
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_DEV_AUTH === "true";

  if (!isClerkConfigured && !allowDevAuth) {
    return res.status(401).json({
      error: "Authentication not configured. Set Clerk keys or enable ALLOW_DEV_AUTH=true in development.",
    });
  }

  const userId = getRequestUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in to use this endpoint." });
  }

  (req as any).resolvedUserId = userId;
  return next();
}

export function requireRole(role: "candidate" | "recruiter") {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const auth = await resolveAuth(_req);
    if (auth.role !== role) {
      return res.status(403).json({ error: `${role} role required.` });
    }
    return next();
  };
}

export function recruiterOnly(_req: Request, res: Response, next: NextFunction) {
  const role = (_req as any).resolvedRole;
  if (role !== "recruiter") {
    return res.status(403).json({ error: "Recruiter role required." });
  }
  return next();
}

export function candidateOnly(_req: Request, res: Response, next: NextFunction) {
  const role = (_req as any).resolvedRole;
  if (role !== "candidate") {
    return res.status(403).json({ error: "Candidate role required." });
  }
  return next();
}

export async function assertRecruiterOwnsJob(
  req: Request,
  res: Response,
  jobId: string | mongoose.Types.ObjectId,
): Promise<boolean> {
  const { Job } = await import("@workspace/db");
  const userId = getRequestUserId(req);
  const job = await Job.findById(jobId).lean();
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return false;
  }
  if (String(job.postedBy) !== userId) {
    res.status(404).json({ error: "Job not found." });
    return false;
  }
  return true;
}

export async function assertRecruiterOwnsApplication(
  req: Request,
  res: Response,
  applicationId: string | mongoose.Types.ObjectId,
): Promise<{ jobId: mongoose.Types.ObjectId; applicantUserId: string } | null> {
  const { Application } = await import("@workspace/db");
  const userId = getRequestUserId(req);
  const app = await Application.findById(applicationId).lean();
  if (!app) {
    res.status(404).json({ error: "Application not found." });
    return null;
  }
  if (String(app.recruiterId) !== userId) {
    res.status(404).json({ error: "Application not found." });
    return null;
  }
  return { jobId: app.jobId, applicantUserId: app.applicantUserId };
}

export const ALLOWED_TRANSITIONS: Record<
  "Applied" | "Shortlisted" | "Interview" | "Offer" | "Hired" | "Rejected",
  string[]
> = {
  Applied: ["Shortlisted", "Rejected"],
  Shortlisted: ["Interview", "Rejected"],
  Interview: ["Offer", "Rejected"],
  Offer: ["Hired", "Rejected"],
  Hired: [],
  Rejected: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return (
    (ALLOWED_TRANSITIONS[from as keyof typeof ALLOWED_TRANSITIONS] ?? []).includes(
      to,
    ) ?? false
  );
}
