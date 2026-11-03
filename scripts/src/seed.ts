/**
 * seed.ts
 *
 * Demo seed: 2 recruiters, 5 candidates, 4 open jobs, sample applications
 * (one with a completed, server-graded assessment attempt), plus role-bearing
 * UserProfiles so role guards work out of the box.
 *
 * Run: pnpm seed   (root)  or  pnpm --filter @workspace/scripts run seed
 */
import crypto from "crypto";
import mongoose from "mongoose";
import {
  connectDB,
  User,
  UserProfile,
  Job,
  Application,
  Assessment,
  AssessmentAttempt,
} from "@workspace/db";

const PASSWORD = "TalentIQ@2026";

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
}

const RECRUITERS = [
  { userId: "user_rec_001", email: "recruiter.one@talentiq.ai", name: "Sam Rivera", company: "TalentIQ Hiring Co" },
  { userId: "user_rec_002", email: "recruiter.two@talentiq.ai", name: "Dana Reyes", company: "Nexus Talent" },
];

const CANDIDATES = [
  { userId: "user_cand_001", email: "jordan.lee@talentiq.ai", name: "Jordan Lee", headline: "Senior Full Stack Engineer", location: "San Francisco, CA", yearsExperience: 6, skills: ["React", "TypeScript", "Node.js", "PostgreSQL"], education: "B.S. Computer Science, Stanford" },
  { userId: "user_cand_002", email: "rohan.sharma@talentiq.ai", name: "Rohan Sharma", headline: "Backend Systems Engineer", location: "Bengaluru, India", yearsExperience: 5, skills: ["Go", "Kafka", "Redis", "Kubernetes"], education: "B.Tech, IIT Delhi" },
  { userId: "user_cand_003", email: "priya.patel@talentiq.ai", name: "Priya Patel", headline: "Machine Learning Engineer", location: "Berlin, Germany", yearsExperience: 4, skills: ["Python", "PyTorch", "RAG", "Vector DB"], education: "M.S. AI, TU Munich" },
  { userId: "user_cand_004", email: "ananya.verma@talentiq.ai", name: "Ananya Verma", headline: "Product Designer", location: "London, UK", yearsExperience: 8, skills: ["Figma", "Design Systems", "UI/UX"], education: "B.A. Design, Royal College of Art" },
  { userId: "user_cand_005", email: "samuel.kim@talentiq.ai", name: "Samuel Kim", headline: "DevOps Engineer", location: "Seattle, WA", yearsExperience: 5, skills: ["AWS", "Kubernetes", "Terraform", "CI/CD"], education: "B.S. Computer Science, UW" },
];

const JOBS = [
  { recruiterIdx: 0, title: "Senior Full Stack Engineer", company: "TalentIQ Hiring Co", description: "Build checkout infrastructure at scale.", requiredSkills: ["React", "Node.js", "TypeScript", "PostgreSQL"], location: "San Francisco, CA", salaryRange: "$140k – $180k", employmentType: "Full-time" },
  { recruiterIdx: 0, title: "Machine Learning Engineer", company: "TalentIQ Hiring Co", description: "RAG-based search and recommendation.", requiredSkills: ["Python", "PyTorch", "RAG", "Vector DB"], location: "Berlin, Germany", salaryRange: "$130k – $160k", employmentType: "Full-time" },
  { recruiterIdx: 1, title: "Backend Systems Engineer", company: "Nexus Talent", description: "Distributed systems in Go.", requiredSkills: ["Go", "Kafka", "Redis", "Kubernetes"], location: "Bengaluru, India", salaryRange: "₹30 – ₹45 LPA", employmentType: "Full-time" },
  { recruiterIdx: 1, title: "Product Designer", company: "Nexus Talent", description: "Design systems and mobile UX.", requiredSkills: ["Figma", "Design Systems", "UI/UX"], location: "London, UK", salaryRange: "£70k – £100k", employmentType: "Full-time" },
];

async function main() {
  await connectDB();
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Users + profiles
    for (const r of RECRUITERS) {
      const salt = crypto.randomBytes(16).toString("hex");
      await User.updateOne(
        { userId: r.userId },
        {
          $set: {
            userId: r.userId,
            name: r.name,
            email: r.email,
            passwordHash: `${salt}:${hashPassword(PASSWORD, salt)}`,
            role: "recruiter",
            authProvider: "local",
          },
        },
        { upsert: true, setDefaultsOnInsert: true, session },
      );
      await UserProfile.updateOne(
        { userId: r.userId },
        {
          $set: {
            userId: r.userId,
            role: "recruiter",
            companyName: r.company,
            name: r.name,
            headline: "Lead Technical Recruiter",
            location: r.company === "TalentIQ Hiring Co" ? "New York, NY" : "Austin, TX",
            yearsExperience: 7,
            skills: ["Technical Recruiting", "Pipeline Management", "Interviewing"],
            education: "B.A. Organizational Psychology",
            resumeLink: "",
          },
        },
        { upsert: true, setDefaultsOnInsert: true, session },
      );
    }
    for (const c of CANDIDATES) {
      const salt = crypto.randomBytes(16).toString("hex");
      await User.updateOne(
        { userId: c.userId },
        {
          $set: {
            userId: c.userId,
            name: c.name,
            email: c.email,
            passwordHash: `${salt}:${hashPassword(PASSWORD, salt)}`,
            role: "candidate",
            authProvider: "local",
          },
        },
        { upsert: true, setDefaultsOnInsert: true, session },
      );
      await UserProfile.updateOne(
        { userId: c.userId },
        {
          $set: {
            userId: c.userId,
            role: "candidate",
            companyName: "",
            name: c.name,
            headline: c.headline,
            location: c.location,
            yearsExperience: c.yearsExperience,
            skills: c.skills,
            education: c.education,
            resumeLink: "",
          },
        },
        { upsert: true, setDefaultsOnInsert: true, session },
      );
    }

    const now = new Date();
    const jobDocs: any[] = [];
    for (const j of JOBS) {
      const recruiter = RECRUITERS[j.recruiterIdx];
      const doc = await Job.create(
        [
          {
            title: j.title,
            company: j.company,
            description: j.description,
            requiredSkills: j.requiredSkills,
            location: j.location,
            salaryRange: j.salaryRange,
            employmentType: j.employmentType,
            postedBy: recruiter.userId,
            status: "Open",
            applicantsCount: 0,
          },
        ],
        { session },
      );
      jobDocs.push(doc[0]);
    }

    // Applications
    const nowIso = now.toISOString();
    const applications = [
      // Jordan -> Senior Full Stack Engineer (recruiter 0): Shortlisted + assessment done
      {
        job: jobDocs[0], applicant: CANDIDATES[0], status: "Shortlisted" as const,
        matchScore: 92, note: "Strong React/TypeScript match.",
      },
      // Rohan -> Backend Systems Engineer (recruiter 1): Interview
      {
        job: jobDocs[2], applicant: CANDIDATES[1], status: "Interview" as const,
        matchScore: 87, note: "Go/Kafka depth impressed the team.",
      },
      // Priya -> Machine Learning Engineer (recruiter 0): Applied
      {
        job: jobDocs[1], applicant: CANDIDATES[2], status: "Applied" as const,
        matchScore: 78, note: "Awaiting recruiter review.",
      },
      // Ananya -> Product Designer (recruiter 1): Offer
      {
        job: jobDocs[3], applicant: CANDIDATES[3], status: "Offer" as const,
        matchScore: 91, note: "Design systems lead profile.",
      },
      // Samuel -> Backend Systems Engineer (recruiter 1): Rejected
      {
        job: jobDocs[2], applicant: CANDIDATES[4], status: "Rejected" as const,
        matchScore: 61, note: "Below required bar for this round.",
      },
      // Jordan -> Machine Learning Engineer (recruiter 0): Applied (duplicate job diff)
      {
        job: jobDocs[1], applicant: CANDIDATES[0], status: "Applied" as const,
        matchScore: 55, note: "Skills partially overlap.",
      },
    ];

    const createdApps: any[] = [];
    for (const a of applications) {
      const history = [
        { status: "Applied", changedBy: a.job.postedBy, at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), note: "Application received." },
      ];
      if (a.status !== "Applied") {
        history.push({ status: a.status, changedBy: a.job.postedBy, at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), note: a.note });
      }
      const doc = await Application.create(
        [
          {
            jobId: a.job._id,
            jobTitle: a.job.title,
            company: a.job.company,
            recruiterId: a.job.postedBy,
            applicantUserId: a.applicant.userId,
            applicantName: a.applicant.name,
            applicantHeadline: a.applicant.headline,
            status: a.status,
            matchScore: a.matchScore,
            appliedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            statusHistory: history,
          },
        ],
        { session },
      );
      createdApps.push(doc[0]);
    }

    // Increment applicants counts
    for (const j of JOBS) {
      const recruiter = RECRUITERS[j.recruiterIdx];
      const count = createdApps.filter((a: any) => a.recruiterId === recruiter.userId && a.jobTitle === j.title).length;
      await Job.updateOne({ _id: jobDocs.find((d: any) => d.title === j.title && d.company === j.company)?._id }, { $set: { applicantsCount: count } }, { session });
    }

    // One completed assessment attempt bound to job 0, linked to Jordan's application
    const assessment = (await Assessment.create(
      [
        {
          jobId: jobDocs[0]._id,
          title: "Senior Full Stack Engineer · Role Skill Assessment",
          durationMinutes: 10,
          assessmentType: "MCQ",
          createdBy: RECRUITERS[0].userId,
          questions: [
            {
              prompt: "Which React practice eliminates scroll lag for 5,000+ item lists?",
              options: [
                "FlashList with getItemLayout and memoized renderItem",
                "Single ScrollView with React.memo",
                "Map items inside a View with inline keys",
                "Pre-render all 5,000 items",
              ],
              correctAnswer: "FlashList with getItemLayout and memoized renderItem",
              explanation: "Virtualization recycles cells; getItemLayout skips dynamic measurement.",
              difficulty: "Medium",
            },
          ],
        },
      ],
      { session },
    ))[0];

    const jordanApp = createdApps[0];
    const focusLosses = 1;
    const integrityScore = Math.max(0, 100 - 20 * focusLosses);
    const attempt = (await AssessmentAttempt.create(
      [
        {
          userId: CANDIDATES[0].userId,
          jobId: jobDocs[0]._id,
          assessmentId: assessment._id,
          score: 1,
          total: 1,
          focusLosses,
          integrityScore,
          flagged: focusLosses >= 3,
          events: [{ type: "focus-loss", at: new Date(now.getTime() - 900000) }],
          startedAt: new Date(now.getTime() - 1200000),
          completedAt: new Date(now.getTime() - 900000),
        },
      ],
      { session },
    ))[0];

    await Application.updateOne(
      { _id: jordanApp._id },
      { $set: { assessmentAttemptId: attempt._id } },
      { session },
    );

    await session.commitTransaction();
    console.log("Seed complete.");
    console.log("Recruiters:", RECRUITERS.map((r) => `${r.email} / ${PASSWORD}`).join("\n  "));
    console.log("Candidates:", CANDIDATES.map((c) => `${c.email} / ${PASSWORD}`).join("\n  "));
    process.exit(0);
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    session.endSession();
    await mongoose.disconnect();
  }
}

main();






