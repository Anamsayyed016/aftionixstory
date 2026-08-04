import { describe, expect, it } from "vitest";

import {
  buildGigJobPostingJsonLd,
  escapeHtml,
  gigValidThrough,
  isGigPastValidThrough,
  isRemoteLocation,
} from "@/lib/marketplace/job-posting";
import { isSafeAppPath } from "@/lib/marketplace/schemas";

const baseGig = {
  id: "gig_test_123",
  title: "Logo design",
  description: "Need a simple mark for kraft bags.",
  skillNeeded: "logo design",
  category: "design",
  location: "Pune" as string | null,
  budget: "₹8,000–12,000",
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  business: {
    name: "Bright Print Co",
    slug: "bright-print-co",
    location: "Pune",
    verifiedAt: new Date("2026-08-01T09:00:00.000Z"),
  },
};

describe("JobPosting JSON-LD", () => {
  it("builds required JobPosting fields for an on-site gig", () => {
    const ld = buildGigJobPostingJsonLd(baseGig);
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.title).toBe("Logo design");
    expect(ld.datePosted).toBe("2026-08-01");
    expect(ld.validThrough).toBe(
      gigValidThrough(baseGig.createdAt).toISOString()
    );
    expect(ld.employmentType).toBe("CONTRACTOR");
    expect(ld.hiringOrganization).toMatchObject({
      "@type": "Organization",
      name: "Bright Print Co",
      sameAs: expect.stringContaining("/b/bright-print-co"),
      logo: expect.stringContaining("/icon.png"),
    });
    expect(ld.jobLocation).toMatchObject({
      address: {
        addressLocality: "Pune",
        addressCountry: "IN",
      },
    });
    expect(ld.jobLocationType).toBeUndefined();
    expect(ld.baseSalary).toBeUndefined();
    expect(String(ld.description)).toContain("<p>");
    expect(String(ld.description)).not.toContain("contactEmail");
    expect(String(ld.description)).not.toMatch(/@/);
  });

  it("uses TELECOMMUTE for remote locations and states that in description", () => {
    const ld = buildGigJobPostingJsonLd({
      ...baseGig,
      location: "remote",
    });
    expect(ld.jobLocationType).toBe("TELECOMMUTE");
    expect(ld.applicantLocationRequirements).toEqual({
      "@type": "Country",
      name: "IN",
    });
    expect(ld.jobLocation).toBeUndefined();
    expect(String(ld.description)).toMatch(/100% remote/i);
  });

  it("rejects unverified businesses", () => {
    expect(() =>
      buildGigJobPostingJsonLd({
        ...baseGig,
        business: { ...baseGig.business, verifiedAt: null },
      })
    ).toThrow(/verified/);
  });

  it("flags gigs past validThrough", () => {
    const old = new Date("2020-01-01T00:00:00.000Z");
    expect(isGigPastValidThrough(old, new Date("2026-08-01"))).toBe(true);
    expect(
      isGigPastValidThrough(new Date("2026-07-01"), new Date("2026-08-01"))
    ).toBe(false);
  });

  it("escapes HTML in descriptions", () => {
    expect(escapeHtml(`a <b> & "x"`)).toBe("a &lt;b&gt; &amp; &quot;x&quot;");
  });

  it("detects remote location strings", () => {
    expect(isRemoteLocation("Remote")).toBe(true);
    expect(isRemoteLocation("Pune")).toBe(false);
  });

  it("allows /g/ callback paths", () => {
    expect(isSafeAppPath("/g/gig_test_123")).toBe(true);
  });
});
