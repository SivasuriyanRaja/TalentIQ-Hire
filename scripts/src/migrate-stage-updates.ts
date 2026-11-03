/**
 * migrate-stage-updates.ts
 *
 * One-time migration: moves legacy RecruiterStageUpdate documents
 * (keyed by recruiterId + candidateName) into Application.statusHistory,
 * keyed by application with recruiter ownership. Best-effort: stages whose
 * candidate name matches an application's applicantName for that recruiter
 * are appended as history entries; applications keep their latest known status.
 *
 * Run: pnpm --filter @workspace/scripts run migrate:stage-updates
 */
import mongoose from "mongoose";
import { connectDB, Application } from "@workspace/db";

const LEGACY_STAGE_SCHEMA = new mongoose.Schema(
  {
    recruiterId: { type: String, required: true },
    candidateName: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: Date,
    updatedAt: Date,
  },
  { collection: "recruiterstageupdates" },
);

async function main() {
  await connectDB();

  const LegacyStage = mongoose.model(
    "RecruiterStageUpdateLegacy",
    LEGACY_STAGE_SCHEMA,
  );

  const stages = await LegacyStage.find().lean();
  console.log(`Found ${stages.length} legacy recruiter stage updates.`);

  let applied = 0;
  let skipped = 0;

  for (const stage of stages) {
    const apps = await Application.find({
      recruiterId: stage.recruiterId,
      applicantName: stage.candidateName,
    }).lean();

    if (apps.length === 0) {
      skipped += 1;
      continue;
    }

    for (const app of apps) {
      const already = (app.statusHistory ?? []).some((h: { status: string; changedBy: string }) =>
        h.status === stage.status && h.changedBy === stage.recruiterId,
      );
      if (already) continue;

      await Application.updateOne(
        { _id: app._id },
        {
          $set: { status: stage.status },
          $push: {
            statusHistory: {
              status: stage.status,
              changedBy: stage.recruiterId,
              at: stage.createdAt ?? new Date(),
              note: "Migrated from legacy RecruiterStageUpdate.",
            },
          },
        },
      );
      applied += 1;
    }
  }

  console.log(
    `Migration complete: ${applied} status history entries added, ${skipped} legacy stages had no matching application.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});




