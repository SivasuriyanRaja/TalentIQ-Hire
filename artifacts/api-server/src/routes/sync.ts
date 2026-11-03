/**
 * sync.ts — Cloud-synced profile, resume, and application routes.
 *
 * Legacy recruiter-stage routes (keyed by candidate name) and the legacy
 * CloudApplication/RecruiterStageUpdate models have been removed. Recruiters
 * now use /api/recruiter/* and candidates use /api/applications plus the new
 * /api/assessments/* contract.
 */

import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  Application,
  AssessmentAttempt,
  Job,
  UserProfile,
} from "@workspace/db";
import { logger } from "../lib/logger";
import {
  requireAuth,
  resolveAuth,
} from "../lib/auth";
import {
  upload,
  handleResumeUpload,
  readFileText,
  validateResumeMagic,
  sanitizeFileName,
} from "../lib/resume";
import { RESUME_UPLOAD_DIR } from "../app";

const router = Router();

const xkiroBaseUrl = "https://api.xkiro.com/v1";
const xkiroModel = "mistralai/mistral-large-4-0";

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE")) return null;
  return new OpenAI({ apiKey, baseURL: xkiroBaseUrl });
}

const COMMON_TECH_SKILLS = [
  "JavaScript", "TypeScript", "React", "React Native", "Vue", "Angular", "Next.js",
  "Node.js", "Express", "Python", "Django", "FastAPI", "Java", "Spring Boot",
  "C++", "C#", ".NET", "Go", "Golang", "Rust", "Swift", "Kotlin", "Flutter",
  "HTML5", "CSS3", "Tailwind CSS", "Redux", "GraphQL", "REST API", "SQL",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS",
  "Azure", "GCP", "CI/CD", "Git", "GitHub", "Linux", "Terraform", "Agile",
  "Scrum", "Jest", "Cypress", "UI/UX", "Figma", "Machine Learning", "TensorFlow",
  "PyTorch", "System Design", "Microservices", "Collaboration", "Product Design"
];

function extractSkillsFromKeywords(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const skill of COMMON_TECH_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, "i");
    if (regex.test(text)) {
      found.push(skill);
      if (found.length >= 15) break;
    }
  }
  return found;
}

async function extractSkillsFromText(text: string): Promise<string[]> {
  const client = getOpenAI();
  if (client && text.trim()) {
    try {
      const completion = await client.chat.completions.create({
        model: xkiroModel,
        messages: [
          {
            role: "system",
            content:
              "You are a technical recruiter. Extract a list of concrete professional skills from the resume text provided. Return ONLY a JSON object with a single key 'skills' whose value is an array of up to 20 concise skill strings.",
          },
          { role: "user", content: text.slice(0, 8000) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.15,
        max_tokens: 400,
      });

      const content = completion.choices[0]?.message.content ?? "";
      const parsed = JSON.parse(content) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "skills" in parsed &&
        Array.isArray((parsed as Record<string, unknown>).skills)
      ) {
        const skills = ((parsed as Record<string, unknown>).skills as unknown[])
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 20);
        if (skills.length > 0) return skills;
      }
    } catch {
      // Fall through to keyword matching
    }
  }

  const keywordSkills = extractSkillsFromKeywords(text);
  if (keywordSkills.length > 0) return keywordSkills;

  return ["TypeScript", "React Native", "Mobile Architecture", "RESTful APIs", "System Design"];
}

// ─── Role sync (NEW) ──────────────────────────────────────────────────────

const RoleSchema = z.object({
  role: z.enum(["candidate", "recruiter"]),
  companyName: z.string().max(160).optional(),
});

router.post("/sync/role", requireAuth, async (req: Request, res: Response) => {
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Valid role is required.");
    return;
  }

  const { userId } = await resolveAuth(req);
  const { role, companyName } = parsed.data;

  try {
    await UserProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          role,
          ...(role === "recruiter" && companyName != null ? { companyName } : {}),
        },
      },
      { upsert: true, setDefaultsOnInsert: true, new: true, lean: true },
    );
      res.json({ message: "Role saved.", role });
  } catch (err) {
    (req as any).log?.error("Failed to save role", String(err));
    res.status(500).json({ error: "Could not save role." });
  }
});

// ─── Profile routes ───────────────────────────────────────────────────────

router.get("/sync/profile", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  try {
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) {
      res.status(404).json({ error: "No cloud profile yet." });
      return;
    }
    res.json(profile);
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to fetch cloud profile");
    res.status(500).json({ error: "Could not load your profile." });
  }
});

router.put("/sync/profile", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  const body = req.body as Record<string, unknown>;

  const allowed = [
    "name",
    "headline",
    "location",
    "yearsExperience",
    "skills",
    "education",
    "resumeLink",
  ] as const;

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (typeof update.name === "string") {
    update.name = update.name.trim().slice(0, 120);
    if (!update.name) {
      sendError(res, 400, "Name is required.");
      return;
    }
  }

  try {
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
    );
    res.json(profile);
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to save cloud profile");
    res.status(500).json({ error: "Could not save your profile." });
  }
});

// ─── Resume upload ────────────────────────────────────────────────────────

router.post(
  "/sync/profile/resume",
  requireAuth,
  handleResumeUpload,
  async (req, res) => {
    const { userId } = await resolveAuth(req);
    const file = req.file;
    if (!file) {
      sendError(res, 400, "No resume file was uploaded.");
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    try {
      validateResumeMagic(file.path, ext);
    } catch {
      try { fs.unlinkSync(file.path); } catch {}
      sendError(res, 400, "File contents do not match the declared file type.");
      return;
    }

    try {
      const existing = (await UserProfile.findOne({ userId }).lean()) as any;
      if (existing?.resumeFileKey) {
        const oldPath = path.join(RESUME_UPLOAD_DIR, existing.resumeFileKey);
          if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }

      const resumeText = await readFileText(file.path, ext);
      const extractedSkills = await extractSkillsFromText(resumeText);

      const safeName = sanitizeFileName(file.originalname);

      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            resumeFileKey: file.filename,
            resumeFileName: safeName,
            resumeFileMime: file.mimetype,
            resumeFileSizeBytes: file.size,
            extractedSkills,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
      );

      res.json({
        message: "Resume uploaded and skills extracted.",
        resumeFileName: safeName,
        resumeFileSizeBytes: file.size,
        extractedSkills,
        profile,
      });
    } catch (err) {
      (req as any).log?.error({ err }, "Resume upload failed");
      try { fs.unlinkSync(file.path); } catch {}
      res.status(500).json({ error: "Resume upload failed. Please try again." });
    }
  },
);

router.get("/sync/profile/resume", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  try {
    const profile = (await UserProfile.findOne({ userId }).lean()) as any;
    if (!profile?.resumeFileKey) {
      res.status(404).json({ error: "No resume file found." });
      return;
    }
    const filePath = path.join(RESUME_UPLOAD_DIR, profile.resumeFileKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Resume file not found on server." });
      return;
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(profile.resumeFileName ?? "resume")}"`,
    );
    res.setHeader("Content-Type", profile.resumeFileMime ?? "application/octet-stream");
    res.sendFile(filePath);
  } catch (err) {
    (req as any).log?.error({ err }, "Resume download failed");
    res.status(500).json({ error: "Could not download resume." });
  }
});

// ─── Applications (mapped to the single source of truth) ──────────────────

router.get("/sync/applications", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  try {
    const applications = await Application.find({ applicantUserId: userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(
      applications.map((a) => ({
        id: a._id,
        jobId: a.jobId,
        jobTitle: a.jobTitle,
        company: a.company,
        status: a.status,
        matchScore: a.matchScore,
        appliedAt: a.appliedAt,
      })),
    );
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to fetch cloud applications");
    res.status(500).json({ error: "Could not load applications." });
  }
});

const ApplicationUpsertSchema = z.object({
  jobId: z.string(),
  jobTitle: z.string().max(160),
  company: z.string().max(160),
  status: z
    .enum(["Applied", "Shortlisted", "Interview", "Offer", "Hired", "Rejected"])
    .default("Applied"),
  matchScore: z.number().min(0).max(100).default(0),
  appliedAt: z.string().optional(),
});

router.post("/sync/applications", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  const parsed = ApplicationUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "jobId, jobTitle and company are required.");
    return;
  }

  const { jobId, jobTitle, company, status, matchScore, appliedAt } = parsed.data;

  try {
    const app = await Application.findOneAndUpdate(
      { applicantUserId: userId, jobId: jobId.trim() },
      {
        $set: {
          jobTitle: jobTitle.trim().slice(0, 160),
          company: company.trim().slice(0, 160),
          status,
          matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
          appliedAt: typeof appliedAt === "string" ? appliedAt : new Date().toISOString(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
    );
    res.json(app);
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to upsert cloud application");
    res.status(500).json({ error: "Could not save application." });
  }
});

router.delete("/sync/applications/:jobId", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  const jobId = req.params.jobId;
  try {
    await Application.deleteOne({ applicantUserId: userId, jobId });
    res.json({ message: "Application removed." });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to delete cloud application");
    res.status(500).json({ error: "Could not remove application." });
  }
});

// ─── Assessment attempts (legacy sink, best effort) ───────────────────────

router.post("/sync/assessments", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  const body = req.body as Record<string, unknown>;

  const jobId = typeof body.jobId === "string" && body.jobId.trim();
  const score = typeof body.score === "number" ? body.score : 0;
  const total = typeof body.total === "number" && body.total >= 1 ? body.total : 1;
  const focusLosses = typeof body.focusLosses === "number" ? Math.max(0, body.focusLosses) : 0;

  if (!jobId) {
    sendError(res, 400, "jobId is required.");
    return;
  }

  const integrityScore = Math.max(0, 100 - 20 * focusLosses);

  try {
    await AssessmentAttempt.create({
      userId,
      jobId: new mongoose.Types.ObjectId(),
      assessmentId: new mongoose.Types.ObjectId(),
      score,
      total,
      focusLosses,
      integrityScore,
      flagged: focusLosses >= 3,
      events: [],
      startedAt: new Date(),
      completedAt: new Date(),
    });
    res.json({ message: "Assessment attempt recorded." });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to save assessment attempt");
    res.status(500).json({ error: "Could not save assessment attempt." });
  }
});

router.get("/sync/assessments", requireAuth, async (req, res) => {
  const { userId } = await resolveAuth(req);
  try {
    const attempts = await AssessmentAttempt.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json(attempts);
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to fetch assessment attempts");
    res.status(500).json({ error: "Could not load assessments." });
  }
});

export default router;





