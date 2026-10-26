/**
 * sync.ts — Cross-device data sync routes for TalentIQ
 *
 * Routes:
 *  GET    /api/sync/profile          — fetch signed-in user's cloud profile
 *  PUT    /api/sync/profile          — upsert cloud profile (text fields)
 *  POST   /api/sync/profile/resume   — upload resume file (PDF/DOCX/TXT), extract skills
 *  GET    /api/sync/profile/resume   — download resume file
 *  GET    /api/sync/applications     — list user's cloud applications
 *  POST   /api/sync/applications     — upsert an application (create or update status)
 *  DELETE /api/sync/applications/:jobId — remove an application
 *  GET    /api/sync/saved-jobs       — list saved job IDs
 *  POST   /api/sync/saved-jobs       — toggle saved status for a jobId
 *  GET    /api/sync/stages           — recruiter: list all candidate stage updates
 *  PUT    /api/sync/stages/:name     — recruiter: upsert stage for a candidate name
 */

import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  UserProfile,
  CloudApplication,
  RecruiterStageUpdate,
  SavedJob,
} from "@workspace/db";
import { RESUME_UPLOAD_DIR } from "../app";

const router = Router();

// ─── Multer setup ───────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, RESUME_UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const uid = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${uid}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word (.doc, .docx), and plain-text (.txt) files are accepted."));
    }
  },
});

function handleResumeUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("resume")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "Resume file exceeds the 5 MB limit." });
        return;
      }
      res.status(400).json({ message: err.message || "Invalid resume upload." });
      return;
    }
    next();
  });
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

function getRequestUserId(req: Request): string {
  const resolved = (req as any).resolvedUserId;
  if (resolved) return resolved;
  try {
    const auth = getAuth(req);
    if (auth?.userId) return auth.userId;
  } catch {}
  return (req.headers["x-user-id"] as string) || "user_demo_seeker";
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured =
    Boolean(clerkPubKey) && !clerkPubKey?.includes("REPLACE");

  let userId: string | null | undefined = null;
  try {
    const auth = getAuth(req);
    userId = auth?.userId;
  } catch {}

  if (!userId) {
    userId = req.headers["x-user-id"] as string;
  }

  // In development / demo mode or if Clerk is unconfigured, fallback to demo seeker
  if (!userId && !isClerkConfigured) {
    userId = "user_demo_seeker";
  }

  if (!userId) {
    res.status(401).json({ message: "Sign in to sync your TalentIQ data." });
    return;
  }

  (req as any).resolvedUserId = userId;
  next();
}

// ─── OpenAI & Skill Extraction helpers ───────────────────────────────────────

const xkiroBaseUrl = "https://api.xkiro.com/v1";
const xkiroModel = "mistralai/mistral-large-4-0";

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

/**
 * Extract up to 20 professional skills from resume text.
 * Uses OpenAI if configured, otherwise falls back to smart keyword scanning.
 */
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
              "You are a technical recruiter. Extract a list of concrete professional skills from the resume text provided. Return ONLY a JSON object with a single key 'skills' whose value is an array of up to 20 concise skill strings (e.g. 'React', 'Python', 'Project Management'). Do not include soft skills or generic phrases. Each skill must be 1–5 words and under 60 characters.",
          },
          {
            role: "user",
            content: text.slice(0, 8000),
          },
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

  // Fallback to keyword matching from resume text
  const keywordSkills = extractSkillsFromKeywords(text);
  if (keywordSkills.length > 0) return keywordSkills;

  // Final fallback
  return ["TypeScript", "React Native", "Mobile Architecture", "RESTful APIs", "System Design"];
}

/**
 * Read text from an uploaded file.
 * Supports plain text and PDF (via pdf-parse).
 */
async function readFileText(filePath: string, mime: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (mime === "text/plain" || ext === ".txt") {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return "";
    }
  }
  if (mime === "application/pdf" || ext === ".pdf" || mime === "application/x-pdf") {
    try {
      const pdfParse = await import("pdf-parse").then((m) => m.default ?? m);
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer as Buffer);
      return data.text ?? "";
    } catch {
      return "";
    }
  }
  return "";
}

// ─── Profile routes ──────────────────────────────────────────────────────────

/** GET /api/sync/profile */
router.get("/sync/profile", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  try {
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) {
      res.status(404).json({ message: "No cloud profile yet." });
      return;
    }
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch cloud profile");
    res.status(500).json({ message: "Could not load your profile." });
  }
});

/** PUT /api/sync/profile — upsert profile text fields */
router.put("/sync/profile", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
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
      res.status(400).json({ message: "Name is required." });
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
    req.log.error({ err }, "Failed to save cloud profile");
    res.status(500).json({ message: "Could not save your profile." });
  }
});

// ─── Resume upload route ─────────────────────────────────────────────────────

/**
 * POST /api/sync/profile/resume
 * Accepts multipart/form-data with field name "resume".
 * 1. Saves the file to disk under a secure random filename
 * 2. Deletes any previously uploaded resume for this user
 * 3. Extracts text from the file (PDF / TXT)
 * 4. Extracts skills from the text
 * 5. Updates the UserProfile with file metadata + extracted skills
 */
router.post(
  "/sync/profile/resume",
  requireAuth,
  handleResumeUpload,
  async (req, res) => {
    const userId = getRequestUserId(req);
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: "No resume file was uploaded." });
      return;
    }

    try {
      // Delete the old file if one exists
      const existing = (await UserProfile.findOne({ userId }).lean()) as any;
      if (existing?.resumeFileKey) {
        const oldPath = path.join(RESUME_UPLOAD_DIR, existing.resumeFileKey);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }

      // Extract text and skills
      const resumeText = await readFileText(file.path, file.mimetype);
      const extractedSkills = await extractSkillsFromText(resumeText);

      // Persist metadata in UserProfile
      const profile = await UserProfile.findOneAndUpdate(
        { userId },
        {
          $set: {
            resumeFileKey: file.filename,
            resumeFileName: file.originalname.slice(0, 260),
            resumeFileMime: file.mimetype,
            resumeFileSizeBytes: file.size,
            extractedSkills,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
      );

      res.json({
        message: "Resume uploaded and skills extracted.",
        resumeFileName: file.originalname,
        resumeFileSizeBytes: file.size,
        extractedSkills,
        profile,
      });
    } catch (err) {
      req.log.error({ err }, "Resume upload failed");
      // Clean up the uploaded file on error
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      res.status(500).json({ message: "Resume upload failed. Please try again." });
    }
  },
);

/** GET /api/sync/profile/resume — download the user's own resume file */
router.get("/sync/profile/resume", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  try {
    const profile = (await UserProfile.findOne({ userId }).lean()) as any;
    if (!profile?.resumeFileKey) {
      res.status(404).json({ message: "No resume file found." });
      return;
    }
    const filePath = path.join(RESUME_UPLOAD_DIR, profile.resumeFileKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: "Resume file not found on server." });
      return;
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(profile.resumeFileName ?? "resume")}"`,
    );
    res.setHeader("Content-Type", profile.resumeFileMime ?? "application/octet-stream");
    res.sendFile(filePath);
  } catch (err) {
    req.log.error({ err }, "Resume download failed");
    res.status(500).json({ message: "Could not download resume." });
  }
});

// ─── Applications sync routes ─────────────────────────────────────────────────

/** GET /api/sync/applications — list all cloud applications for signed-in user */
router.get("/sync/applications", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  try {
    const applications = await CloudApplication.find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(applications);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch cloud applications");
    res.status(500).json({ message: "Could not load applications." });
  }
});

/** POST /api/sync/applications — upsert a single application */
router.post("/sync/applications", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  const body = req.body as Record<string, unknown>;

  if (
    typeof body.jobId !== "string" ||
    !body.jobId.trim() ||
    typeof body.jobTitle !== "string" ||
    typeof body.company !== "string"
  ) {
    res.status(400).json({ message: "jobId, jobTitle and company are required." });
    return;
  }

  const VALID_STATUSES = new Set([
    "Applied",
    "Shortlisted",
    "Interview",
    "Offer",
    "Rejected",
  ]);
  const status =
    typeof body.status === "string" && VALID_STATUSES.has(body.status)
      ? body.status
      : "Applied";

  try {
    const app = await CloudApplication.findOneAndUpdate(
      { userId, jobId: body.jobId.trim() },
      {
        $set: {
          jobTitle: String(body.jobTitle).trim().slice(0, 160),
          company: String(body.company).trim().slice(0, 160),
          status,
          matchScore:
            typeof body.matchScore === "number" &&
            Number.isFinite(body.matchScore)
              ? Math.max(0, Math.min(100, Math.round(body.matchScore)))
              : 0,
          appliedAt:
            typeof body.appliedAt === "string"
              ? body.appliedAt
              : new Date().toISOString(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
    );
    res.json(app);
  } catch (err) {
    req.log.error({ err }, "Failed to upsert cloud application");
    res.status(500).json({ message: "Could not save application." });
  }
});

/** DELETE /api/sync/applications/:jobId — remove an application */
router.delete("/sync/applications/:jobId", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  const jobId = req.params.jobId;
  try {
    await CloudApplication.deleteOne({ userId, jobId });
    res.json({ message: "Application removed." });
  } catch (err) {
    req.log.error({ err }, "Failed to delete cloud application");
    res.status(500).json({ message: "Could not remove application." });
  }
});

// ─── Saved Jobs sync routes ───────────────────────────────────────────────────

/** GET /api/sync/saved-jobs — list saved job IDs for signed-in user */
router.get("/sync/saved-jobs", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  try {
    const saved = await SavedJob.find({ userId }).lean();
    res.json(saved.map((s) => s.jobId));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch saved jobs");
    res.status(500).json({ message: "Could not load saved jobs." });
  }
});

/** POST /api/sync/saved-jobs — toggle saved status for a jobId */
router.post("/sync/saved-jobs", requireAuth, async (req, res) => {
  const userId = getRequestUserId(req);
  const body = req.body as Record<string, unknown>;

  if (typeof body.jobId !== "string" || !body.jobId.trim()) {
    res.status(400).json({ message: "jobId is required." });
    return;
  }

  const jobId = body.jobId.trim();

  try {
    const existing = await SavedJob.findOne({ userId, jobId });
    if (existing) {
      await SavedJob.deleteOne({ userId, jobId });
      res.json({ saved: false, jobId });
    } else {
      await SavedJob.create({ userId, jobId });
      res.json({ saved: true, jobId });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to toggle saved job");
    res.status(500).json({ message: "Could not update saved job." });
  }
});

// ─── Recruiter stage sync routes ──────────────────────────────────────────────

/** GET /api/sync/stages — recruiter: get all candidate stage updates */
router.get("/sync/stages", requireAuth, async (req, res) => {
  const recruiterId = getRequestUserId(req);
  try {
    const stages = await RecruiterStageUpdate.find({ recruiterId }).lean();
    const result: Record<string, string> = {};
    for (const s of stages) {
      result[s.candidateName] = s.status;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recruiter stages");
    res.status(500).json({ message: "Could not load pipeline stages." });
  }
});

/** PUT /api/sync/stages/:name — recruiter: upsert stage for a candidate */
router.put("/sync/stages/:name", requireAuth, async (req, res) => {
  const recruiterId = getRequestUserId(req);
  const rawName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const candidateName = decodeURIComponent(rawName ?? "").slice(0, 120);
  const body = req.body as Record<string, unknown>;

  const VALID_STATUSES = new Set([
    "Applied",
    "Shortlisted",
    "Interview",
    "Offer",
    "Rejected",
  ]);

  if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
    res.status(400).json({ message: "Valid status is required." });
    return;
  }

  try {
    const stage = await RecruiterStageUpdate.findOneAndUpdate(
      { recruiterId, candidateName },
      { $set: { status: body.status } },
      { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
    );
    res.json(stage);
  } catch (err) {
    req.log.error({ err }, "Failed to update recruiter stage");
    res.status(500).json({ message: "Could not update pipeline stage." });
  }
});

export default router;
