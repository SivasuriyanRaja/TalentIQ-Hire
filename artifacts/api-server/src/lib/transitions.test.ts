import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, isValidTransition } from "../lib/auth";

describe("stage transition rules", () => {
  it("allows Applied -> Shortlisted and Applied -> Rejected", () => {
    expect(isValidTransition("Applied", "Shortlisted")).toBe(true);
    expect(isValidTransition("Applied", "Rejected")).toBe(true);
  });

  it("allows Shortlisted -> Interview and Shortlisted -> Rejected", () => {
    expect(isValidTransition("Shortlisted", "Interview")).toBe(true);
    expect(isValidTransition("Shortlisted", "Rejected")).toBe(true);
  });

  it("allows Interview -> Offer and Interview -> Rejected", () => {
    expect(isValidTransition("Interview", "Offer")).toBe(true);
    expect(isValidTransition("Interview", "Rejected")).toBe(true);
  });

  it("allows Offer -> Hired and Offer -> Rejected", () => {
    expect(isValidTransition("Offer", "Hired")).toBe(true);
    expect(isValidTransition("Offer", "Rejected")).toBe(true);
  });

  it("rejects Hired -> anything (terminal)", () => {
    expect(isValidTransition("Hired", "Shortlisted")).toBe(false);
    expect(isValidTransition("Hired", "Applied")).toBe(false);
    expect(isValidTransition("Hired", "Hired")).toBe(false);
  });

  it("rejects Rejected -> anything (terminal)", () => {
    expect(isValidTransition("Rejected", "Shortlisted")).toBe(false);
    expect(isValidTransition("Rejected", "Hired")).toBe(false);
  });

  it("rejects backward transitions", () => {
    expect(isValidTransition("Shortlisted", "Applied")).toBe(false);
    expect(isValidTransition("Interview", "Shortlisted")).toBe(false);
    expect(isValidTransition("Offer", "Interview")).toBe(false);
    expect(isValidTransition("Hired", "Offer")).toBe(false);
  });

  it("exposes the full transition map", () => {
    expect(ALLOWED_TRANSITIONS.Applied).toEqual(["Shortlisted", "Rejected"]);
    expect(ALLOWED_TRANSITIONS.Hired).toEqual([]);
    expect(ALLOWED_TRANSITIONS.Rejected).toEqual([]);
  });
});

