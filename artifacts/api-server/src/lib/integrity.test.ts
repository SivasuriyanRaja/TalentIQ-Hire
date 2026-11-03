import { describe, it, expect } from "vitest";

// Integrity rule (mirrors server-side calculation in POST /assessments/:id/submit):
// integrityScore = max(0, 100 - 20 * focusLosses); flagged if focusLosses >= 3.
const computeIntegrity = (focusLosses: number) => ({
  integrityScore: Math.max(0, 100 - 20 * focusLosses),
  flagged: focusLosses >= 3,
});

describe("integrity calculation", () => {
  it("no focus loss -> 100, not flagged", () => {
    expect(computeIntegrity(0)).toEqual({ integrityScore: 100, flagged: false });
  });

  it("1 focus loss -> 80, not flagged", () => {
    expect(computeIntegrity(1)).toEqual({ integrityScore: 80, flagged: false });
  });

  it("2 focus losses -> 60, not flagged", () => {
    expect(computeIntegrity(2)).toEqual({ integrityScore: 60, flagged: false });
  });

  it("3 focus losses -> 40, flagged", () => {
    expect(computeIntegrity(3)).toEqual({ integrityScore: 40, flagged: true });
  });

  it("5 focus losses -> 0 (clamped), flagged", () => {
    expect(computeIntegrity(5)).toEqual({ integrityScore: 0, flagged: true });
  });

  it("10 focus losses -> 0 (clamped), flagged", () => {
    expect(computeIntegrity(10)).toEqual({ integrityScore: 0, flagged: true });
  });
});

