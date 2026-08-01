import { describe, expect, it } from "vitest";
import {
  isBusinessPubliclyVisible,
  normalizeEmail,
  resolveBusinessVerifiedAt,
} from "@/lib/marketplace/verification";

describe("business verification", () => {
  it("normalizes email case and whitespace", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
    expect(normalizeEmail("")).toBeNull();
  });

  it("verifies when contact email matches owner account email", () => {
    const at = resolveBusinessVerifiedAt({
      ownerEmail: "owner@aftionix.example",
      contactEmail: "Owner@aftionix.example",
    });
    expect(at).toBeInstanceOf(Date);
  });

  it("preserves previous verifiedAt when still matching", () => {
    const previous = new Date("2026-01-01T00:00:00.000Z");
    const at = resolveBusinessVerifiedAt({
      ownerEmail: "a@b.com",
      contactEmail: "a@b.com",
      previousVerifiedAt: previous,
    });
    expect(at).toBe(previous);
  });

  it("clears verification when contact email diverges", () => {
    expect(
      resolveBusinessVerifiedAt({
        ownerEmail: "a@b.com",
        contactEmail: "other@b.com",
        previousVerifiedAt: new Date(),
      })
    ).toBeNull();
  });

  it("gates public visibility on verifiedAt", () => {
    expect(isBusinessPubliclyVisible(null)).toBe(false);
    expect(isBusinessPubliclyVisible(new Date())).toBe(true);
  });
});
