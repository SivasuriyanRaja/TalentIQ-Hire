import mongoose, { Schema, Document } from "mongoose";

// ─── Job ───────────────────────────────────────────────────────────────────

export type JobStatus = "Draft" | "Open" | "Closed";

export interface IJob extends Document {
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  location?: string;
  salaryRange?: string;
  employmentType?: string;
  postedBy: string; // Clerk userId
  status: JobStatus;
  applicantsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true, maxlength: 160 },
    company: { type: String, required: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 6000 },
    requiredSkills: [{ type: String, maxlength: 100 }],
    location: { type: String, maxlength: 200 },
    salaryRange: { type: String, maxlength: 100 },
    employmentType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Remote"],
    },
    postedBy: { type: String, required: true, index: true }, // Clerk userId
    status: {
      type: String,
      enum: ["Draft", "Open", "Closed"],
      default: "Open",
      index: true,
    },
    applicantsCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

JobSchema.index({ postedBy: 1, status: 1 });

export const Job =
  (mongoose.models.Job ?? mongoose.model<IJob>("Job", JobSchema)) as unknown as mongoose.Model<IJob>;

// ─── Application (single source of truth for applications) ─────────────────

export type ApplicationStatus =
  | "Applied"
  | "Shortlisted"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected";

export interface IStatusHistoryEntry {
  status: ApplicationStatus;
  changedBy: string; // Clerk userId (recruiter who moved the stage)
  at: Date;
  note?: string;
}

export interface IMatchBreakdown {
  skillMatch: number;
  experienceMatch: number;
  roleFit: number;
  strengths: string[];
  missingSkills: string[];
  recommendation: string;
}

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  jobTitle: string;
  company: string;
  recruiterId: string; // Clerk userId, copied from Job.postedBy
  applicantUserId: string; // Clerk userId
  applicantName: string;
  applicantHeadline: string;
  status: ApplicationStatus;
  matchScore?: number;
  matchBreakdown?: IMatchBreakdown;
  assessmentAttemptId?: mongoose.Types.ObjectId;
  statusHistory: IStatusHistoryEntry[];
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    jobTitle: { type: String, required: true, maxlength: 160 },
    company: { type: String, required: true, maxlength: 160 },
    recruiterId: { type: String, required: true, index: true },
    applicantUserId: { type: String, required: true, index: true },
    applicantName: { type: String, required: true, maxlength: 120 },
    applicantHeadline: { type: String, maxlength: 200, default: "" },
    status: {
      type: String,
      enum: ["Applied", "Shortlisted", "Interview", "Offer", "Hired", "Rejected"],
      default: "Applied",
    },
    matchScore: { type: Number, min: 0, max: 100 },
    matchBreakdown: {
      skillMatch: { type: Number, min: 0, max: 100 },
      experienceMatch: { type: Number, min: 0, max: 100 },
      roleFit: { type: Number, min: 0, max: 100 },
      strengths: [{ type: String, maxlength: 200 }],
      missingSkills: [{ type: String, maxlength: 100 }],
      recommendation: { type: String, maxlength: 1000 },
    },
    assessmentAttemptId: { type: Schema.Types.ObjectId, ref: "AssessmentAttempt" },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["Applied", "Shortlisted", "Interview", "Offer", "Hired", "Rejected"],
          required: true,
        },
        changedBy: { type: String, required: true },
        at: { type: Date, required: true, default: Date.now },
        note: { type: String, maxlength: 600 },
      },
    ],
    appliedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

ApplicationSchema.index(
  { applicantUserId: 1, jobId: 1 },
  { unique: true },
);
ApplicationSchema.index({ recruiterId: 1, status: 1 });

export const Application =
  (mongoose.models.Application ??
  mongoose.model<IApplication>("Application", ApplicationSchema)) as unknown as mongoose.Model<IApplication>;

// ─── Assessment (questions + answer key persisted server-side) ─────────────

export interface IAssessmentQuestion {
  prompt: string;
  options: string[];
  correctAnswer: string; // NEVER sent to the client
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface IAssessment extends Document {
  jobId?: mongoose.Types.ObjectId;
  title: string;
  durationMinutes: number;
  questions: IAssessmentQuestion[];
  createdBy: string; // Clerk userId
  assessmentType: "MCQ" | "APTITUDE";
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    title: { type: String, required: true, maxlength: 100 },
    durationMinutes: { type: Number, min: 5, max: 60, required: true },
    questions: [
      {
        prompt: { type: String, required: true, maxlength: 700 },
        options: [{ type: String, maxlength: 120 }],
        correctAnswer: { type: String, required: true },
        explanation: { type: String, maxlength: 500 },
        difficulty: {
          type: String,
          enum: ["Easy", "Medium", "Hard"],
          required: true,
        },
      },
    ],
    createdBy: { type: String, required: true },
    assessmentType: {
      type: String,
      enum: ["MCQ", "APTITUDE"],
      required: true,
    },
  },
  { timestamps: true },
);

export const Assessment =
  (mongoose.models.Assessment ??
  mongoose.model<IAssessment>("Assessment", AssessmentSchema)) as unknown as mongoose.Model<IAssessment>;

// ─── AssessmentAttempt (server-graded, proctoring integrity) ───────────────

export interface IAssessmentAttemptEvent {
  type: string;
  at: Date;
}

export interface IAssessmentAttempt extends Document {
  userId: string; // Clerk userId (candidate)
  jobId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  score: number;
  total: number;
  integrityScore: number; // max(0, 100 - 20 * focusLosses)
  flagged: boolean; // focusLosses >= 3
  focusLosses: number;
  events: IAssessmentAttemptEvent[];
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    assessmentId: { type: Schema.Types.ObjectId, ref: "Assessment", required: true },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    focusLosses: { type: Number, required: true, min: 0, default: 0 },
    integrityScore: { type: Number, required: true, min: 0, max: 100 },
    flagged: { type: Boolean, required: true, default: false },
    events: [
      {
        type: { type: String, required: true },
        at: { type: Date, required: true, default: Date.now },
      },
    ],
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AssessmentAttemptSchema.index({ userId: 1, jobId: 1 });

export const AssessmentAttempt =
  (mongoose.models.AssessmentAttempt ??
  mongoose.model<IAssessmentAttempt>("AssessmentAttempt", AssessmentAttemptSchema)) as unknown as mongoose.Model<IAssessmentAttempt>;

// ─── UserProfile (cloud-synced profile; role lives here) ───────────────────

export type ProfileRole = "candidate" | "recruiter";

export interface IUserProfile extends Document {
  userId: string; // Clerk userId — unique per user
  role: ProfileRole;
  companyName: string;
  name: string;
  headline: string;
  location: string;
  yearsExperience: number;
  skills: string[]; // manually entered skills
  education: string;
  resumeLink: string; // optional external URL (backwards-compat)
  resumeFileKey?: string; // storage key / filename on server disk
  resumeFileName?: string; // original file name shown in UI
  resumeFileMime?: string; // MIME type of uploaded file
  resumeFileSizeBytes?: number;
  extractedSkills: string[]; // AI-extracted skills from uploaded resume
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    role: {
      type: String,
      enum: ["candidate", "recruiter"],
      default: "candidate",
      index: true,
    },
    companyName: { type: String, maxlength: 160, default: "" },
    name: { type: String, required: true, maxlength: 120 },
    headline: { type: String, maxlength: 200, default: "" },
    location: { type: String, maxlength: 200, default: "" },
    yearsExperience: { type: Number, min: 0, max: 60, default: 0 },
    skills: [{ type: String, maxlength: 100 }],
    education: { type: String, maxlength: 300, default: "" },
    resumeLink: { type: String, maxlength: 500, default: "" },
    resumeFileKey: { type: String, maxlength: 300 },
    resumeFileName: { type: String, maxlength: 260 },
    resumeFileMime: { type: String, maxlength: 100 },
    resumeFileSizeBytes: { type: Number, min: 0 },
    extractedSkills: [{ type: String, maxlength: 100 }],
  },
  { timestamps: true },
);

export const UserProfile =
  (mongoose.models.UserProfile ??
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema)) as unknown as mongoose.Model<IUserProfile>;

// ─── User (Native Auth Account) ──────────────────────────────────────────

export interface IUser extends Document {
  userId: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: "candidate" | "recruiter";
  headline?: string;
  location?: string;
  avatarUrl?: string;
  googleId?: string;
  authProvider?: "local" | "google" | "clerk";
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: false },
    role: { type: String, enum: ["candidate", "recruiter"], default: "candidate" },
    headline: { type: String, default: "" },
    location: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    googleId: { type: String, sparse: true, index: true },
    authProvider: { type: String, enum: ["local", "google", "clerk"], default: "local" },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const User =
  (mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema)) as unknown as mongoose.Model<IUser>;

