import { describe, it, expect } from "vitest";
import { z } from "zod";

const RoleSchema = z.object({
  role: z.enum(["candidate", "recruiter"]),
  companyName: z.string().max(160).optional(),
});

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

describe("Zod parsers", () => {
  it("accepts a valid recruiter role", () => {
    const parsed = RoleSchema.safeParse({ role: "recruiter", companyName: "Acme" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.role).toBe("recruiter");
  });

  it("rejects an invalid role", () => {
    const parsed = RoleSchema.safeParse({ role: "admin" });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid stage update", () => {
    const parsed = StageUpdateSchema.safeParse({ status: "Shortlisted", note: "Strong fit" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a note over 600 chars", () => {
    const parsed = StageUpdateSchema.safeParse({ status: "Applied", note: "a".repeat(601) });
    expect(parsed.success).toBe(false);
  });
});

