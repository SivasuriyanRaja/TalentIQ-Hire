import { Router, type NextFunction, type Request, type Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  Application,
  Assessment,
  AssessmentAttempt,
  Job,
  UserProfile,
  type IApplication,
  type IJob,
  type IAssessment,
  type IAssessmentAttempt,
} from "@workspace/db";
import {
  generateDynamicAssessment,
  generateDynamicMatchAnalysis,
  evaluateAssessment,
  ServerAssessmentQuestion
} from "../lib/assessmentEngine";
import {
  assertRecruiterOwnsApplication,
  getRequestUserId,
  isValidTransition,
  requireAuth,
  requireRole,
} from "../lib/auth";
import { publish, channelFor } from "../lib/sse";
import { RESUME_UPLOAD_DIR } from "../app";
import fs from "fs";
import path from "path";

const router = Router();

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

function validateBody<T>(
  schema: z.ZodTypeAny,
  body: unknown,
): { data: T } | { error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { error: `Invalid request: ${issues}` };
  }
  return { data: result.data as T };
}

function applicationPublicShape(app: IApplication) {
  return {
    id: app._id,
    jobId: app.jobId,
    jobTitle: app.jobTitle,
    company: app.company,
    recruiterId: app.recruiterId,
    applicantUserId: app.applicantUserId,
    applicantName: app.applicantName,
    applicantHeadline: app.applicantHeadline,
    status: app.status,
    matchScore: app.matchScore,
    matchBreakdown: app.matchBreakdown,
    assessmentAttemptId: app.assessmentAttemptId,
    statusHistory: app.statusHistory,
    appliedAt: app.appliedAt,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

// ─── Validation schemas ───────────────────────────────────────────────────

type JobBodyInput = z.infer<typeof JobBodySchema>;

const JobBodySchema = z.object({
  title: z.string().min(1).max(160),
  company: z.string().min(1).max(160),
  description: z.string().min(1).max(6000),
  requiredSkills: z.array(z.string().max(100)).max(50).default([]),
  location: z.string().max(200).optional(),
  salaryRange: z.string().max(100).optional(),
  employmentType: z
    .enum(["Full-time", "Part-time", "Contract", "Internship", "Remote"])
    .optional(),
});

type JobUpdateInput = z.infer<typeof JobUpdateSchema>;

const JobUpdateSchema = JobBodySchema.partial().and(
  z.object({
    status: z.enum(["Draft", "Open", "Closed"]).optional(),
  }),
);

type ApplicationCreateInput = z.infer<typeof ApplicationCreateSchema>;

const ApplicationCreateSchema = z.object({
  jobId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid job id."),
});

type StageUpdateInput = z.infer<typeof StageUpdateSchema>;

const StageUpdateSchema = z.object({
  status: z.enum([
    "Applied",
    "Shortlisted",
    "Interview",
    "Offer",
    "Hired",
    "Rejected",
  ]),
  note: z.string().max(600).optional(),
});

type AssessmentGenerateInput = z.infer<typeof AssessmentGenerateSchema>;

const AssessmentGenerateSchema = z.object({
  jobId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Invalid job id."),
  assessmentType: z.enum(["MCQ", "APTITUDE"]).default("MCQ"),
  questionCount: z.number().int().min(3).max(10).default(5),
});

type AssessmentSubmitInput = z.infer<typeof AssessmentSubmitSchema>;

const AssessmentSubmitSchema = z.object({
  answers: z.record(z.string()),
  focusLosses: z.number().int().min(0).default(0),
  events: z
    .array(
      z.object({ type: z.string(), at: z.string().datetime().optional() }),
    )
    .default([]),
  timeSpentSeconds: z.number().int().min(0).default(0),
  identityPledgeSigned: z.boolean().default(true),
});

type ListQueryInput = z.infer<typeof ListQuerySchema>;

const ListQuerySchema = z.object({
  jobId: z.string().optional(),
  status: z
    .enum([
      "Applied",
      "Shortlisted",
      "Interview",
      "Offer",
      "Hired",
      "Rejected",
    ])
    .optional(),
  sort: z.enum(["matchScore", "integrity", "date"]).default("date"),
  page: z.string().optional().transform((v) => Math.max(1, Number(v ?? 1))),
  limit: z.string().optional().transform((v) => {
    return Math.max(1, Math.min(100, Number(v ?? 20)));
  }),
});

// ─── Recruiter Job CRUD ───────────────────────────────────────────────────

router.post(
  "/recruiter/jobs",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const parsed = validateBody<JobBodyInput>(JobBodySchema, req.body);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }
    const userId = getRequestUserId(req);
    const job = await Job.create({
      ...parsed.data,
      postedBy: userId,
      status: "Open",
      applicantsCount: 0,
    });
    res.status(201).json(job);
  },
);

router.get("/recruiter/jobs", requireRole("recruiter"), async (req, res) => {
  const userId = getRequestUserId(req);
  const filter: Record<string, unknown> = { postedBy: userId };
  if (req.query.status) filter.status = req.query.status;
  const jobs = await Job.find(filter).sort({ updatedAt: -1 }).lean();
  res.json(jobs);
});

router.put(
  "/recruiter/jobs/:id",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const userId = getRequestUserId(req);
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      sendError(res, 404, "Job not found.");
      return;
    }
    if (String(job.postedBy) !== userId) {
      sendError(res, 404, "Job not found.");
      return;
    }
    const parsed = validateBody<JobUpdateInput>(JobUpdateSchema, req.body);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }
    const update: Record<string, unknown> = { ...parsed.data };
    delete update.postedBy;
    const updated = await Job.findByIdAndUpdate(req.params.id, update, {
      new: true,
      lean: true,
    });
    res.json(updated);
  },
);

router.delete(
  "/recruiter/jobs/:id",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const userId = getRequestUserId(req);
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      sendError(res, 404, "Job not found.");
      return;
    }
    if (String(job.postedBy) !== userId) {
      sendError(res, 404, "Job not found.");
      return;
    }
    if ((job.applicantsCount ?? 0) > 0) {
      sendError(res, 409, "Cannot delete a job that already has applications.");
      return;
    }
    await Job.deleteOne({ _id: req.params.id });
    res.json({ message: "Job deleted." });
  },
);

// ─── Public jobs list ─────────────────────────────────────────────────────

router.get("/jobs", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 20)));

  const filter: Record<string, unknown> = { status: "Open" };
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [
      { title: { $regex: regex } },
      { company: { $regex: regex } },
      { requiredSkills: { $regex: regex } },
    ];
  }

  const [items, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);

  res.json({
    jobs: items.map((j) => ({ id: j._id, ...j })),
    page,
    limit,
    total,
  });
});

// ─── Candidate applies (server-computed match snapshot) ──────────────────

router.post(
  "/applications",
  requireRole("candidate"),
  async (req: Request, res: Response) => {
    const parsed = validateBody<ApplicationCreateInput>(ApplicationCreateSchema, req.body);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }
    const userId = getRequestUserId(req);

    const job = (await Job.findById(parsed.data.jobId).lean()) as IJob | null;
    if (!job) {
      sendError(res, 404, "Job not found.");
      return;
    }
    if (job.status !== "Open") {
      sendError(res, 400, "This job is not accepting applications.");
      return;
    }

    const existing = await Application.findOne({
      applicantUserId: userId,
      jobId: parsed.data.jobId,
    }).lean();
    if (existing) {
      sendError(res, 409, "You have already applied to this job.");
      return;
    }

    const profile = (((await UserProfile.findOne({ userId }).lean()) ??
      {}) as any) || {};
    const candidateSkills: string[] = Array.isArray(profile.skills)
      ? profile.skills
      : [];
    const yearsExperience: number =
      typeof profile.yearsExperience === "number" ? profile.yearsExperience : 0;

    const match = generateDynamicMatchAnalysis({
      candidateName: typeof profile.name === "string" ? profile.name : "Candidate",
      yearsExperience,
      candidateSkills,
      jobTitle: job.title,
      company: job.company,
      description: job.description,
      requiredSkills: job.requiredSkills,
    });

    const now = new Date();
    const application = await Application.create({
      jobId: parsed.data.jobId,
      jobTitle: job.title,
      company: job.company,
      recruiterId: job.postedBy,
      applicantUserId: userId,
      applicantName: typeof profile.name === "string" ? profile.name : "Candidate",
      applicantHeadline: typeof profile.headline === "string" ? profile.headline : "",
      status: "Applied",
      matchScore: match.matchScore,
      matchBreakdown: match,
      appliedAt: now,
      statusHistory: [
        { status: "Applied", changedBy: userId, at: now, note: "Applied." },
      ],
    });

    await Job.updateOne({ _id: job._id }, { $inc: { applicantsCount: 1 } });

    const payload = {
      applicationId: application._id,
      jobId: application.jobId,
      jobTitle: application.jobTitle,
      applicantName: application.applicantName,
      matchScore: application.matchScore,
      at: now,
    };
    publish(channelFor("recruiter", job.postedBy), "application.created", payload);
    publish(channelFor("candidate", userId), "application.created", payload);

    res.status(201).json({ application: applicationPublicShape(application) });
  },
);

// ─── Recruiter application list ───────────────────────────────────────────

router.get(
  "/recruiter/applications",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const userId = getRequestUserId(req);
    const parsed = validateBody<ListQueryInput>(ListQuerySchema, req.query);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }

    const filter: Record<string, unknown> = { recruiterId: userId };
    if (parsed.data.jobId) {
      const job = (await Job.findById(parsed.data.jobId).lean()) as IJob | null;
      if (!job) {
        sendError(res, 404, "Job not found.");
        return;
      }
      if (String(job.postedBy) !== userId) {
        sendError(res, 404, "Job not found.");
        return;
      }
      filter.jobId = parsed.data.jobId;
    }
    if (parsed.data.status) filter.status = parsed.data.status;

    const sortMap: Record<string, Record<string, -1 | 1>> = {
      matchScore: { matchScore: -1 },
      integrity: { "attempt.integrityScore": -1 },
      date: { updatedAt: -1 },
    };

    const pipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: "assessmentattempts",
          let: { auid: "$applicantUserId", jid: "$jobId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$auid"] },
                    { $eq: ["$jobId", "$$jid"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "attempts",
        },
      },
      { $addFields: { attempt: { $arrayElemAt: ["$attempts", 0] } } },
      { $sort: sortMap[parsed.data.sort] },
    ];

    const [items, total] = await Promise.all([
      Application.aggregate([
        ...pipeline,
        { $project: { attempts: 0 } },
        { $skip: (parsed.data.page - 1) * parsed.data.limit },
        { $limit: parsed.data.limit },
      ]),
      Application.countDocuments(filter),
    ]);

    res.json({
      applications: items,
      page: parsed.data.page,
      limit: parsed.data.limit,
      total,
      hasMore: parsed.data.page * parsed.data.limit < total,
    });
  },
);

// ─── Recruiter application detail ─────────────────────────────────────────

router.get(
  "/recruiter/applications/:id",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const owned = await assertRecruiterOwnsApplication(req, res, String(req.params.id));
    if (!owned) return;

    const app = (await Application.findById(String(req.params.id)).lean()) as IApplication | null;
    if (!app) {
      sendError(res, 404, "Application not found.");
      return;
    }

    let attempt: IAssessmentAttempt | null = null;
    if (app.assessmentAttemptId) {
      attempt = (await AssessmentAttempt.findById(app.assessmentAttemptId).lean()) as IAssessmentAttempt | null;
    }
    const profile = ((await UserProfile.findOne({
      userId: app.applicantUserId,
    }).lean()) ?? {}) as any;

    res.json({
      application: applicationPublicShape(app),
      attempt: attempt
        ? {
            id: attempt._id,
            score: attempt.score,
            total: attempt.total,
            focusLosses: attempt.focusLosses,
            integrityScore: attempt.integrityScore,
            flagged: attempt.flagged,
            events: attempt.events,
            startedAt: attempt.startedAt,
            completedAt: attempt.completedAt,
          }
        : null,
      resume: {
        hasFile: Boolean(profile.resumeFileKey),
        fileName: profile.resumeFileName,
        sizeBytes: profile.resumeFileSizeBytes,
        mime: profile.resumeFileMime,
      },
    });
  },
);

// ─── Stage transition ─────────────────────────────────────────────────────

router.patch(
  "/recruiter/applications/:id/stage",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const owned = await assertRecruiterOwnsApplication(req, res, String(req.params.id));
    if (!owned) return;

    const parsed = validateBody<StageUpdateInput>(StageUpdateSchema, req.body);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }

    const app = (await Application.findById(String(req.params.id))) as any;
    if (!app) {
      sendError(res, 404, "Application not found.");
      return;
    }

    const from = app.status;
    const to = parsed.data.status;
    if (from === to) {
      res.json({ application: applicationPublicShape(app) });
      return;
    }
    if (!isValidTransition(from, to)) {
      sendError(
        res,
        400,
        `Invalid stage transition from ${from} to ${to}.`,
      );
      return;
    }

    const now = new Date();
    app.status = to;
    app.statusHistory.push({
      status: to,
      changedBy: getRequestUserId(req),
      at: now,
      note: parsed.data.note,
    });
    await app.save();

    const payload = {
      applicationId: app._id,
      jobId: app.jobId,
      jobTitle: app.jobTitle,
      applicantName: app.applicantName,
      status: to,
      changedBy: getRequestUserId(req),
      at: now,
      note: parsed.data.note,
    };
    publish(channelFor("recruiter", app.recruiterId), "application.stage_changed", payload);
    publish(channelFor("candidate", app.applicantUserId), "application.stage_changed", payload);

    res.json({ application: applicationPublicShape(app) });
  },
);

// ─── Resume download (recruiter-owned jobs only) ──────────────────────────

router.get(
  "/recruiter/applications/:id/resume",
  requireRole("recruiter"),
  async (req: Request, res: Response) => {
    const owned = await assertRecruiterOwnsApplication(req, res, String(req.params.id));
    if (!owned) return;

    const app = (await Application.findById(String(req.params.id)).lean()) as IApplication | null;
    if (!app) {
      sendError(res, 404, "Application not found.");
      return;
    }

    const profile = ((await UserProfile.findOne({
      userId: app.applicantUserId,
    }).lean()) ?? {}) as any;
    if (!profile?.resumeFileKey) {
      sendError(res, 404, "No resume on file for this applicant.");
      return;
    }

    const filePath = path.join(RESUME_UPLOAD_DIR, profile.resumeFileKey);
    try {
      await fs.promises.access(filePath);
    } catch {
      sendError(res, 404, "Resume file not found on server.");
      return;
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(
        profile.resumeFileName ?? "resume",
      )}"`,
    );
    res.setHeader("Content-Type", profile.resumeFileMime ?? "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  },
);

// ─── Recruiter stats (Mongo aggregations) ─────────────────────────────────

router.get("/recruiter/stats", requireRole("recruiter"), async (req, res) => {
  const userId = getRequestUserId(req);

  const [openRoles, totalApplicants, byStatus, avgMatch] = await Promise.all([
    Job.countDocuments({ postedBy: userId, status: "Open" }),
    Application.countDocuments({ recruiterId: userId }),
    Application.aggregate([
      { $match: { recruiterId: userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Application.aggregate([
      { $match: { recruiterId: userId } },
      { $group: { _id: null, avg: { $avg: "$matchScore" } } },
    ]),
  ]);

  const jobIds = (
    await Job.find({ postedBy: userId }).distinct("_id")
  ).map((id) => new mongoose.Types.ObjectId(id as string));
  const flaggedAttempts =
    jobIds.length > 0
      ? await AssessmentAttempt.countDocuments({
          jobId: { $in: jobIds },
          flagged: true,
        })
      : 0;

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[String(row._id)] = row.count;

  res.json({
    openRoles,
    totalApplicants,
    shortlisted: statusCounts.Shortlisted ?? 0,
    interviews: statusCounts.Interview ?? 0,
    offers: statusCounts.Offer ?? 0,
    hires: statusCounts.Hired ?? 0,
    rejected: statusCounts.Rejected ?? 0,
    avgMatch: avgMatch[0]?.avg ? Math.round(avgMatch[0].avg) : 0,
    flaggedAttempts,
  });
});

// ─── Assessments (server-persisted, bound to a job) ───────────────────────

router.post(
  "/assessments/generate",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = validateBody<AssessmentGenerateInput>(AssessmentGenerateSchema, req.body);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }

    const job = (await Job.findById(parsed.data.jobId).lean()) as IJob | null;
    if (!job) {
      sendError(res, 404, "Job not found.");
      return;
    }

    const userId = getRequestUserId(req);
    const generated = generateDynamicAssessment(
      job.title,
      job.requiredSkills,
      parsed.data.assessmentType,
      parsed.data.questionCount,
    );

    const assessment = await Assessment.create({
      jobId: parsed.data.jobId,
      title: generated.title,
      durationMinutes: generated.durationMinutes,
      questions: generated.questions,
      createdBy: userId,
      assessmentType: parsed.data.assessmentType,
    });

    // Client never receives correctAnswer.
    res.json({
      id: assessment._id,
      title: assessment.title,
      durationMinutes: assessment.durationMinutes,
      questions: generated.questions.map((q, i) => ({
        id: i,
        prompt: q.prompt,
        options: q.options,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
    });
  },
);

router.get(
  "/assessments/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      sendError(res, 400, "Invalid assessment id.");
      return;
    }
    const assessment = (await Assessment.findById(req.params.id).lean()) as IAssessment | null;
    if (!assessment) {
      sendError(res, 404, "Assessment not found.");
      return;
    }
    res.json({
      id: assessment._id,
      title: assessment.title,
      durationMinutes: assessment.durationMinutes,
      questions: assessment.questions.map((q, i) => ({
        id: i,
        prompt: q.prompt,
        options: q.options,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
    });
  },
);

router.post(
  "/assessments/:id/submit",
  requireRole("candidate"),
  async (req: Request, res: Response) => {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      sendError(res, 400, "Invalid assessment id.");
      return;
    }
    const parsed = validateBody<AssessmentSubmitInput>(AssessmentSubmitSchema, req.body);
    if ("error" in parsed) {
      sendError(res, 400, parsed.error);
      return;
    }

    const assessment = (await Assessment.findById(req.params.id).lean()) as IAssessment | null;
    if (!assessment) {
      sendError(res, 404, "Assessment not found.");
      return;
    }

    const userId = getRequestUserId(req);
    const { focusLosses = 0, events = [], timeSpentSeconds = 0, identityPledgeSigned = true } = parsed.data;
    const userAnswers: Record<number, string> = {};
    for (const [key, value] of Object.entries(parsed.data.answers)) {
      userAnswers[Number(key)] = value;
    }

    const evaluation = evaluateAssessment(
      assessment.questions as unknown as ServerAssessmentQuestion[],
      userAnswers,
      parsed.data.focusLosses,
      parsed.data.timeSpentSeconds,
      assessment.title,
    );

    const integrityScore = Math.max(0, 100 - 20 * focusLosses);
    const flagged = focusLosses >= 3;
    const now = new Date();
    const startedAt = new Date(now.getTime() - timeSpentSeconds * 1000);

    const attempt = await AssessmentAttempt.create({
      userId,
      jobId: assessment.jobId as mongoose.Types.ObjectId,
      assessmentId: assessment._id,
      score: evaluation.score,
      total: evaluation.total,
      focusLosses,
      integrityScore,
      flagged,
      events: events.map((e) => ({
        type: e.type,
        at: e.at ? new Date(e.at) : now,
      })),
      startedAt,
      completedAt: now,
    });

    await Application.updateOne(
      { applicantUserId: userId, jobId: assessment.jobId },
      { $set: { assessmentAttemptId: attempt._id as mongoose.Types.ObjectId } },
    );

    publish(
      channelFor("candidate", userId),
      "assessment.completed",
      {
        assessmentId: assessment._id,
        jobId: assessment.jobId,
        score: evaluation.score,
        total: evaluation.total,
        percentage: evaluation.percentage,
        integrityScore,
        flagged,
        at: now,
      },
    );

    res.json({
      id: attempt._id,
      score: evaluation.score,
      total: evaluation.total,
      percentage: evaluation.percentage,
      readinessRating: evaluation.readinessRating,
      integrityStatus: evaluation.integrityStatus,
      integrityScore,
      flagged,
      proxyRiskScore: evaluation.proxyRiskScore,
      proxyRiskLevel: evaluation.proxyRiskLevel,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      growthAreas: evaluation.growthAreas,
      skillsBreakdown: evaluation.skillsBreakdown,
      completedAt: now,
    });
  },
);

// Error handler
router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status ?? 500).json({ error: err.message ?? "Internal server error" });
});

export default router;



