import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "http";
import { Express } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Agent as SuperTestAgent } from "supertest";

import app from "../app";

let mongod: MongoMemoryServer;
let agent: SuperTestAgent;
let server: ReturnType<typeof createServer>;

const RECRUITER_ID = "user_rec_t1";
const CANDIDATE_ID = "user_cand_t1";
const OTHER_RECRUITER_ID = "user_rec_other";

async function seedDb() {
  const { User, UserProfile } = await import("@workspace/db");
  await Promise.all([
    User.updateOne({ userId: RECRUITER_ID }, { $set: { userId: RECRUITER_ID, name: "Rec One", email: "rec1@t.ai", role: "recruiter" } }, { upsert: true }),
    User.updateOne({ userId: CANDIDATE_ID }, { $set: { userId: CANDIDATE_ID, name: "Can One", email: "can1@t.ai", role: "candidate" } }, { upsert: true }),
    User.updateOne({ userId: OTHER_RECRUITER_ID }, { $set: { userId: OTHER_RECRUITER_ID, name: "Rec Two", email: "rec2@t.ai", role: "recruiter" } }, { upsert: true }),
    UserProfile.updateOne({ userId: RECRUITER_ID }, { $set: { userId: RECRUITER_ID, role: "recruiter", name: "Rec One", companyName: "Acme" } }, { upsert: true }),
    UserProfile.updateOne({ userId: CANDIDATE_ID }, { $set: { userId: CANDIDATE_ID, role: "candidate", name: "Can One", skills: ["TypeScript"], yearsExperience: 4 } }, { upsert: true }),
    UserProfile.updateOne({ userId: OTHER_RECRUITER_ID }, { $set: { userId: OTHER_RECRUITER_ID, role: "recruiter", name: "Rec Two", companyName: "Other" } }, { upsert: true }),
  ]);
}

function authAs(userId: string) {
  return { "x-user-id": userId };
}

describe("Recruiter/Candidate API integration", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const supertestModule = await import("supertest");
    agent = supertestModule.default(`http://localhost:${port}`);
    await seedDb();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
    server.close();
  });

  beforeEach(async () => {
    const { Job, Application } = await import("@workspace/db");
    await Job.deleteMany({});
    await Application.deleteMany({});
  });

  it("recruiter creates a job and candidate applies; duplicate apply returns 409", async () => {
    const createRes = await agent
      .post("/api/recruiter/jobs")
      .set(authAs(RECRUITER_ID))
      .send({
        title: "Senior Full Stack Engineer",
        company: "Acme",
        description: "Build checkout at scale.",
        requiredSkills: ["React", "TypeScript", "Node.js"],
        location: "Remote",
        salaryRange: "$140k - $180k",
        employmentType: "Full-time",
      });
    expect(createRes.status).toBe(201);
    const jobId = createRes.body._id;

    const publicJobs = await agent.get("/api/jobs?limit=10");
    expect(publicJobs.status).toBe(200);
    expect(publicJobs.body.jobs.some((j: any) => j._id === jobId)).toBe(true);

    const applyRes = await agent
      .post("/api/applications")
      .set(authAs(CANDIDATE_ID))
      .send({ jobId });
    expect(applyRes.status).toBe(201);
    const appId = applyRes.body.application.id;

    const dup = await agent
      .post("/api/applications")
      .set(authAs(CANDIDATE_ID))
      .send({ jobId });
    expect(dup.status).toBe(409);

    const listRes = await agent.get("/api/recruiter/applications").set(authAs(RECRUITER_ID));
    expect(listRes.status).toBe(200);
    expect(listRes.body.applications.some((a: any) => a.id === appId)).toBe(true);
  });

  it("stage transition updates candidate visibility and history", async () => {
    const { Job, Application } = await import("@workspace/db");
    const job = await Job.create({
      title: "Backend Engineer", company: "Acme", description: "d",
      requiredSkills: ["Go"], postedBy: RECRUITER_ID, status: "Open", applicantsCount: 0,
    });
    const app = await Application.create({
      jobId: job._id, jobTitle: "Backend Engineer", company: "Acme",
      recruiterId: RECRUITER_ID, applicantUserId: CANDIDATE_ID, applicantName: "Can One",
      applicantHeadline: "Backend dev", status: "Applied",
      statusHistory: [{ status: "Applied", changedBy: RECRUITER_ID, at: new Date(), note: "applied" }],
      appliedAt: new Date(),
    });

    const appIdStr = String(app._id);
    const stageRes = await agent
      .patch("/api/recruiter/applications/" + appIdStr + "/stage")
      .set(authAs(RECRUITER_ID))
      .send({ status: "Shortlisted", note: "Strong fit" });
    expect(stageRes.status).toBe(200);
    expect(stageRes.body.application.status).toBe("Shortlisted");
    expect(stageRes.body.application.statusHistory[1].status).toBe("Shortlisted");

    const syncRes = await agent.get("/api/sync/applications").set(authAs(CANDIDATE_ID));
    expect(syncRes.status).toBe(200);
    const synced = syncRes.body.find((a: any) => a.id === appIdStr);
    expect(synced.status).toBe("Shortlisted");

    const bad = await agent
      .patch("/api/recruiter/applications/" + appIdStr + "/stage")
      .set(authAs(RECRUITER_ID))
      .send({ status: "Offer" });
    expect(bad.status).toBe(400);
  });

  it("resume access control: recruiter can only download resumes for their own jobs' applicants", async () => {
    const { UserProfile, Job, Application } = await import("@workspace/db");
    const otherJob = await Job.create({
      title: "Other Role", company: "OtherCo", description: "d",
      requiredSkills: [], postedBy: OTHER_RECRUITER_ID, status: "Open", applicantsCount: 0,
    });
    await UserProfile.updateOne(
      { userId: CANDIDATE_ID },
      { $set: { resumeFileKey: "resumes/secret.pdf", resumeFileName: "secret.pdf", resumeFileMime: "application/pdf", resumeFileSizeBytes: 100 } },
      { upsert: true },
    );
    const otherApp = await Application.create({
      jobId: otherJob._id, jobTitle: "Other Role", company: "OtherCo",
      recruiterId: OTHER_RECRUITER_ID, applicantUserId: CANDIDATE_ID, applicantName: "Can One",
      applicantHeadline: "", status: "Applied", statusHistory: [], appliedAt: new Date(),
    });

    const otherAppIdStr = String(otherApp._id);
    const res = await agent.get("/api/recruiter/applications/" + otherAppIdStr + "/resume").set(authAs(RECRUITER_ID));
    expect(res.status).toBe(404);
  });

  it("role guard: candidate cannot create a recruiter job (403)", async () => {
    const res = await agent
      .post("/api/recruiter/jobs")
      .set(authAs(CANDIDATE_ID))
      .send({ title: "X", company: "C", description: "d", requiredSkills: [] });
    expect(res.status).toBe(403);
  });

  it("ownership enforcement: recruiter cannot touch another recruiter's job/application", async () => {
    const { Job } = await import("@workspace/db");
    const otherJob = await Job.create({
      title: "Other Role", company: "OtherCo", description: "d",
      requiredSkills: [], postedBy: OTHER_RECRUITER_ID, status: "Open", applicantsCount: 0,
    });

    const otherJobIdStr = String(otherJob._id);
    const upd = await agent
      .put("/api/recruiter/jobs/" + otherJobIdStr)
      .set(authAs(RECRUITER_ID))
      .send({ title: "Hacked" });
    expect(upd.status).toBe(404);

    const del = await agent.delete("/api/recruiter/jobs/" + otherJobIdStr).set(authAs(RECRUITER_ID));
    expect(del.status).toBe(404);
  });

  it("stats endpoint returns aggregations", async () => {
    const { Job, Application } = await import("@workspace/db");
    await Job.create({ title: "J1", company: "C", description: "d", requiredSkills: [], postedBy: RECRUITER_ID, status: "Open", applicantsCount: 0 });
    await Job.create({ title: "J2", company: "C", description: "d", requiredSkills: [], postedBy: RECRUITER_ID, status: "Closed", applicantsCount: 0 });
    await Application.create({ jobId: new mongoose.Types.ObjectId(), jobTitle: "J1", company: "C", recruiterId: RECRUITER_ID, applicantUserId: CANDIDATE_ID, applicantName: "Can One", applicantHeadline: "", status: "Shortlisted", matchScore: 90, statusHistory: [], appliedAt: new Date() });

    const res = await agent.get("/api/recruiter/stats").set(authAs(RECRUITER_ID));
    expect(res.status).toBe(200);
    expect(res.body.openRoles).toBe(1);
    expect(res.body.shortlisted).toBe(1);
    expect(res.body.totalApplicants).toBe(1);
    expect(res.body.avgMatch).toBe(90);
  });
});
