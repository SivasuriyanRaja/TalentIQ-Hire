import mongoose, { Schema, Document } from "mongoose";

// ─── Job ───────────────────────────────────────────────────────────────────

export interface IJob extends Document {
  title: string;
  company: string;
  description: string;
  requiredSkills: string[];
  location?: string;
  salaryRange?: string;
  employmentType?: string;
  postedBy: string; // Clerk userId
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
    postedBy: { type: String, required: true }, // Clerk userId
  },
  { timestamps: true },
);

export const Job =
  mongoose.models.Job ?? mongoose.model<IJob>("Job", JobSchema);

// ─── Application ───────────────────────────────────────────────────────────

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  applicantId: string; // Clerk userId
  applicantName: string;
  applicantEmail: string;
  skills: string[];
  yearsExperience: number;
  resumeText?: string;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  matchScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    applicantId: { type: String, required: true },
    applicantName: { type: String, required: true, maxlength: 120 },
    applicantEmail: { type: String, required: true, maxlength: 200 },
    skills: [{ type: String, maxlength: 100 }],
    yearsExperience: { type: Number, min: 0, max: 60, required: true },
    resumeText: { type: String, maxlength: 10000 },
    status: {
      type: String,
      enum: ["pending", "reviewed", "accepted", "rejected"],
      default: "pending",
    },
    matchScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true },
);

export const Application =
  mongoose.models.Application ??
  mongoose.model<IApplication>("Application", ApplicationSchema);

// ─── Assessment ────────────────────────────────────────────────────────────

export interface IAssessmentQuestion {
  prompt: string;
  options: string[];
  correctAnswer: string;
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
  mongoose.models.Assessment ??
  mongoose.model<IAssessment>("Assessment", AssessmentSchema);

// ─── UserProfile (cloud-synced candidate profile) ──────────────────────────

export interface IUserProfile extends Document {
  userId: string;              // Clerk userId — unique per user
  name: string;
  headline: string;
  location: string;
  yearsExperience: number;
  skills: string[];            // manually entered skills
  education: string;
  resumeLink: string;          // optional external URL (backwards-compat)
  resumeFileKey?: string;      // storage key / filename on server disk
  resumeFileName?: string;     // original file name shown in UI
  resumeFileMime?: string;     // MIME type of uploaded file
  resumeFileSizeBytes?: number;
  extractedSkills: string[];   // AI-extracted skills from uploaded resume
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
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
  mongoose.models.UserProfile ??
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

// ─── CloudApplication (cross-device candidate application tracker) ─────────

export interface ICloudApplication extends Document {
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: "Applied" | "Shortlisted" | "Interview" | "Offer" | "Rejected";
  matchScore: number;
  appliedAt: string; // ISO string
  createdAt: Date;
  updatedAt: Date;
}

const CloudApplicationSchema = new Schema<ICloudApplication>(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: String, required: true, maxlength: 200 },
    jobTitle: { type: String, required: true, maxlength: 160 },
    company: { type: String, required: true, maxlength: 160 },
    status: {
      type: String,
      enum: ["Applied", "Shortlisted", "Interview", "Offer", "Rejected"],
      default: "Applied",
    },
    matchScore: { type: Number, min: 0, max: 100, default: 0 },
    appliedAt: { type: String, required: true },
  },
  { timestamps: true },
);

// Prevent duplicate applications per user+job
CloudApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export const CloudApplication =
  mongoose.models.CloudApplication ??
  mongoose.model<ICloudApplication>("CloudApplication", CloudApplicationSchema);

// ─── RecruiterStageUpdate (cross-device recruiter pipeline stages) ─────────

export interface IRecruiterStageUpdate extends Document {
  recruiterId: string;   // Clerk userId of recruiter
  candidateName: string;
  status: "Applied" | "Shortlisted" | "Interview" | "Offer" | "Rejected";
  createdAt: Date;
  updatedAt: Date;
}

const RecruiterStageUpdateSchema = new Schema<IRecruiterStageUpdate>(
  {
    recruiterId: { type: String, required: true, index: true },
    candidateName: { type: String, required: true, maxlength: 120 },
    status: {
      type: String,
      enum: ["Applied", "Shortlisted", "Interview", "Offer", "Rejected"],
      default: "Applied",
    },
  },
  { timestamps: true },
);

RecruiterStageUpdateSchema.index(
  { recruiterId: 1, candidateName: 1 },
  { unique: true },
);

export const RecruiterStageUpdate =
  mongoose.models.RecruiterStageUpdate ??
  mongoose.model<IRecruiterStageUpdate>(
    "RecruiterStageUpdate",
    RecruiterStageUpdateSchema,
  );

// ─── SavedJob (cross-device saved job tracker) ────────────────────────────

export interface ISavedJob extends Document {
  userId: string;
  jobId: string;
  createdAt: Date;
  updatedAt: Date;
}

const SavedJobSchema = new Schema<ISavedJob>(
  {
    userId: { type: String, required: true, index: true },
    jobId: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: true },
);

SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export const SavedJob =
  mongoose.models.SavedJob ??
  mongoose.model<ISavedJob>("SavedJob", SavedJobSchema);

// ─── CloudAssessmentAttempt (AI assessment attempts & integrity history) ─────

export interface ICloudAssessmentAttempt extends Document {
  userId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  company: string;
  assessmentTitle: string;
  score: number;
  total: number;
  percentage: number;
  focusLosses: number;
  speedAnomalies: number;
  clipboardViolations: number;
  proxyRiskScore: number;
  proxyRiskLevel: "LOW" | "MEDIUM" | "HIGH";
  identityPledgeSigned: boolean;
  watermarkToken?: string;
  timeSpentSeconds: number;
  feedback: string;
  skillsBreakdown: Array<{ skill: string; score: number }>;
  completedAt: string;
  createdAt: Date;
  updatedAt: Date;
}

const CloudAssessmentAttemptSchema = new Schema<ICloudAssessmentAttempt>(
  {
    userId: { type: String, required: true, index: true },
    candidateName: { type: String, required: true, maxlength: 120 },
    jobId: { type: String, required: true, maxlength: 200, index: true },
    jobTitle: { type: String, required: true, maxlength: 160 },
    company: { type: String, required: true, maxlength: 160 },
    assessmentTitle: { type: String, required: true, maxlength: 160 },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    focusLosses: { type: Number, required: true, min: 0, default: 0 },
    speedAnomalies: { type: Number, required: true, min: 0, default: 0 },
    clipboardViolations: { type: Number, required: true, min: 0, default: 0 },
    proxyRiskScore: { type: Number, required: true, min: 0, max: 100, default: 0 },
    proxyRiskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "LOW",
    },
    identityPledgeSigned: { type: Boolean, default: true },
    watermarkToken: { type: String, maxlength: 120 },
    timeSpentSeconds: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    skillsBreakdown: [
      {
        skill: { type: String, required: true },
        score: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    completedAt: { type: String, required: true },
  },
  { timestamps: true },
);

export const CloudAssessmentAttempt =
  mongoose.models.CloudAssessmentAttempt ??
  mongoose.model<ICloudAssessmentAttempt>(
    "CloudAssessmentAttempt",
    CloudAssessmentAttemptSchema,
  );