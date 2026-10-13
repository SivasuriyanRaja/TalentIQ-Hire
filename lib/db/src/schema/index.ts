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