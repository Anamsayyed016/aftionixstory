import { describe, expect, it } from "vitest";

import {
  businessProfileSchema,
  freelancerProfileSchema,
  gigPostingSchema,
  isSafeAppPath,
} from "@/lib/marketplace/schemas";

describe("marketplace form schemas", () => {
  it("accepts a valid business profile", () => {
    const parsed = businessProfileSchema.safeParse({
      name: "Hoor Studio",
      category: "software",
      location: "Banswara",
      contactEmail: "anamsayyed58@gmail.com",
      summary: "Dev shop",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects business without name", () => {
    const parsed = businessProfileSchema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);
  });

  it("accepts empty contact email as omitted", () => {
    const parsed = businessProfileSchema.safeParse({
      name: "Hoor",
      contactEmail: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.contactEmail).toBeUndefined();
  });

  it("parses freelancer skills from comma string", () => {
    const parsed = freelancerProfileSchema.safeParse({
      summary: "Designer",
      skills: "logo, branding",
      location: "remote",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.skills).toEqual(["logo", "branding"]);
    }
  });

  it("requires gig title and description", () => {
    expect(gigPostingSchema.safeParse({ title: "", description: "x" }).success).toBe(
      false
    );
    expect(
      gigPostingSchema.safeParse({
        title: "Logo",
        description: "Need a mark",
        budget: "₹5k",
      }).success
    ).toBe(true);
  });

  it("gates unsafe callback paths", () => {
    expect(isSafeAppPath("/dashboard?prompt=hi")).toBe(true);
    expect(isSafeAppPath("/connect/business")).toBe(true);
    expect(isSafeAppPath("//evil.com")).toBe(false);
    expect(isSafeAppPath("https://evil.com")).toBe(false);
  });
});
