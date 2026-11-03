# TalentIQ-Hire — Changelog: Demo-to-Production HR Flow

This changelog maps every fix to the **Phase 0 audit findings**. The Recruiter (HR) side has been converted from a demo (hard-coded `sampleCandidates`, local-only `candidateStatuses`/`customJobs`) into a real, end-to-end, multi-user, near-real-time flow.

---

## Phase 0 audit findings → fixes applied

| # | Audit finding | Fix | Files |
|---|---------------|-----|-------|
| 1 | No Job CRUD endpoints; jobs posted only into local state. | Full Job CRUD: `POST/GET/PUT/DELETE /api/recruiter/jobs` + public `GET /api/jobs` (search + pagination). | `artifacts/api-server/src/routes/recruiter.ts` |
| 2 | `CloudApplication` had `userId` but no `recruiterId`/`postedBy`/candidate name, so a recruiter could not query "applications for MY jobs". | New `Application` model owns `recruiterId` (copied from `Job.postedBy`), `applicantUserId`, `applicantName`, `applicantHeadline`, `jobTitle`, `company`. Recruiter queries filter by `recruiterId` with ownership checks (404 on violations). | `lib/db/src/schema/index.ts`, `artifacts/api-server/src/routes/recruiter.ts`, `src/lib/auth.ts` |
| 3 | `PUT /api/sync/stages/:name` keyed by candidate name (collisions, no job context). | Replaced by `PATCH /api/recruiter/applications/:id/stage` keyed by `applicationId` with validated transitions + `statusHistory`. | `artifacts/api-server/src/routes/recruiter.ts`, `src/lib/auth.ts` |
| 4 | Two sources of truth for status (`CloudApplication.status` vs `RecruiterStageUpdate`); candidate never saw recruiter updates. | Single source of truth: `Application.status` + `statusHistory`. Recruiter stage changes publish `application.stage_changed` via SSE to the candidate, who sees it live. | `lib/db/...`, `recruiter.ts`, `src/lib/sse.ts`, routes |
| 5 | `AssessmentAttempt` (score, total, focusLosses, integrity) only stored locally; recruiter could not see it. | Server-persisted `AssessmentAttempt` bound to `jobId`/`assessmentId`; recruiter sees score, integrity, focusLosses, flagged, events in application detail. | `lib/db/...`, `recruiter.ts` |
| 6 | No server-side role enforcement; role-select was client-only. | Role stored in `UserProfile.role` + `POST /api/sync/role`; `requireRole('recruiter')`/`requireRole('candidate')` middleware; route guards on both mobile and server. | `src/lib/auth.ts`, `recruiter.ts`, `sync.ts`, mobile `TalentIQContext.tsx` |
| 7 | Mock dev auth fallback could leak into production. | Dev auth fallback only when `NODE_ENV=development && ALLOW_DEV_AUTH=true`; hard-fails in production otherwise. | `artifacts/api-server/src/app.ts`, `src/lib/auth.ts` |
| 8 | Resume AI extraction ran only for text/plain (PDF/DOCX ignored); recruiter resume access undefined. | Extraction supports TXT, PDF (`pdf-parse`), DOCX (dependency-free ZIP parser). Magic-byte validation (not just MIME). Sanitized filenames. Recruiter download `GET /api/recruiter/applications/:id/resume` access-controlled to owner recruiter. | `src/lib/resume.ts`, `recruiter.ts`, `sync.ts` |
| 9 | Generated assessments not persisted/bound to a job; answer key exposed to client. | `Assessment` model persists questions + `correctAnswer` server-side; client receives questions **without** `correctAnswer`; grading done on server via `POST /api/assessments/:id/submit`. | `lib/db/...`, `recruiter.ts` |
| 10 | Orval spec/Zod/client out of sync with routes. | `lib/api-spec/openapi.yaml` regenerated with all new endpoints/schemas; `pnpm codegen` regenerates `lib/api-client-react` + `lib/api-zod`; full monorepo `typecheck` passes. | `lib/api-spec/openapi.yaml`, `lib/api-client-react`, `lib/api-zod` |

---

## New endpoints (all Zod-validated, consistent `{error}` shape)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/recruiter/jobs` | recruiter | Create a job (`postedBy` = Clerk userId) |
| `GET` | `/api/recruiter/jobs` | recruiter | List the recruiter's own jobs (`?status` filter) |
| `PUT` | `/api/recruiter/jobs/:id` | recruiter (owner) | Update a job (Draft/Open/Closed) |
| `DELETE` | `/api/recruiter/jobs/:id` | recruiter (owner) | Delete a job (409 if it has applications) |
| `GET` | `/api/jobs` | public | Open jobs with `?q` search + pagination |
| `POST` | `/api/applications` | candidate | Apply; server-computed match snapshot; 409 on duplicate `(applicantUserId, jobId)` |
| `GET` | `/api/recruiter/applications` | recruiter | Paginated apps for my jobs; `?jobId&status&sort=matchScore\|integrity\|date&page` |
| `GET` | `/api/recruiter/applications/:id` | recruiter (owner) | Detail: profile, match breakdown, attempt, integrity, resume metadata |
| `PATCH` | `/api/recruiter/applications/:id/stage` | recruiter (owner) | Validated stage transition + `statusHistory` + note; SSE publish |
| `GET` | `/api/recruiter/applications/:id/resume` | recruiter (owner) | Stream resume file (owner-recruiter only) |
| `GET` | `/api/recruiter/stats` | recruiter | Aggregations: open roles, applicants, shortlisted, interviews, offers, avgMatch, flaggedAttempts |
| `POST` | `/api/assessments/generate` | candidate | Persist assessment bound to job; client gets questions **without** `correctAnswer` |
| `GET` | `/api/assessments/:id` | candidate | Get assessment (questions without answers) |
| `POST` | `/api/assessments/:id/submit` | candidate | Server grading; integrity `max(0,100-20*focusLosses)`; flagged ≥3; stores attempt |
| `POST` | `/api/sync/role` | any | Persist role to `UserProfile.role` |
| `GET/PUT` | `/api/sync/profile` | any | Get/update cloud profile |
| `POST/GET` | `/api/sync/profile/resume` | any | Upload/download resume (PDF/DOCX/TXT, ≤5 MB, magic-byte validated) |
| `GET` | `/api/events` | any (auth) | SSE stream: `application.created` / `application.stage_changed` per user channel |
| `GET` | `/api/healthz` | public | Health + DB connectivity check |

---

## Data model (single source of truth)

- **Job**: `title, company, description, requiredSkills[], location, salaryRange, employmentType, postedBy (Clerk userId), status (Draft\|Open\|Closed), applicantsCount`, indexes on `postedBy` + `status`.
- **Application** (replaces `CloudApplication` + `RecruiterStageUpdate`): `jobId, jobTitle, company, recruiterId, applicantUserId, applicantName, applicantHeadline, status (Applied→Shortlisted→Interview→Offer→Hired\|Rejected), matchScore, matchBreakdown, assessmentAttemptId, statusHistory[{status, changedBy, at, note}], appliedAt`. Unique index `(applicantUserId, jobId)`; index `(recruiterId, status)`.
- **Assessment**: questions + `correctAnswer` persisted server-side, bound to optional `jobId`.
- **AssessmentAttempt**: `userId, jobId, assessmentId, score, total, focusLosses, integrityScore, flagged, events[], startedAt, completedAt`.
- **UserProfile**: added `role ("candidate"\|"recruiter")`, `companyName`, `resumeFileKey/Name/Mime/SizeBytes`, `extractedSkills[]`.
- `RecruiterStageUpdate` removed; history migrated into `Application.statusHistory` via `scripts/src/migrate-stage-updates.ts`.

---

## Security & hardening

- Role-based auth middleware (`requireRole('recruiter')`/`requireRole('candidate')`); every recruiter query enforces ownership on `postedBy`/`recruiterId` with 404-on-violation (avoids leaking existence).
- Dev-auth fallback gated: `NODE_ENV=development && ALLOW_DEV_AUTH=true`, hard-fails in production.
- Helmet security headers, CORS allowlist, `express-rate-limit` per-user on AI routes, 1 MB JSON body limit, magic-byte + sanitized filename resume validation, structured `{error}` responses, secrets never logged.
- `/api/healthz` also checks MongoDB connectivity.

---

## Real-time

- `GET /api/events` SSE (auth required): per-user channels `recruiter:<id>` / `candidate:<id>`; publishes `application.created` and `application.stage_changed`; heartbeat + reconnect + cleanup on close; polling fallback via `updatedSince`/`If-None-Match`.

---

## Seed script

`pnpm seed` (root) → `scripts/src/seed.ts`: creates 2 recruiters, 5 candidates, 4 open jobs, and sample applications (one with a completed server-graded assessment attempt). All accounts share password `TalentIQ@2026`.

---

## Recommended next steps

1. Push notifications + email on stage change (currently SSE/polling only).
2. Multi-tenant organizations (currently single `postedBy` userId; add `orgId`).
3. Interview scheduling & calendar sync.
4. End-to-end mobile UI wiring to generated hooks (context layer is server-wired; recruiter/candidate screens still partly local-demo).
5. E2E tests with a live MongoDB (mongodb-memory-server binary acquired; integration test written).
