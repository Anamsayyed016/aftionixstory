import { describe, expect, it } from "vitest";

import {
  canRevealMatchContact,
  publicFreelancerViewContact,
  resolveFreelancerContact,
  revealContactsForMatch,
} from "@/lib/freelance-agent/contact-reveal";
import {
  rankFreelancersForGig,
  scoreGigFreelancerMatch,
} from "@/lib/freelance-agent/matching";

describe("contact reveal gating", () => {
  const business = {
    contactEmail: "biz@example.com",
    contactPhone: "+91 90000 00001",
  };
  const freelancer = {
    contactEmail: "pro@example.com",
    contactPhone: "+91 90000 00002",
    userEmail: "user@example.com",
  };

  it("PENDING — no contact visible", () => {
    expect(canRevealMatchContact("PENDING")).toBe(false);
    const r = revealContactsForMatch({
      status: "PENDING",
      business,
      freelancer,
    });
    expect(r.revealed).toBe(false);
    expect(r.business.email).toBeNull();
    expect(r.business.phone).toBeNull();
    expect(r.freelancer.email).toBeNull();
    expect(r.freelancer.phone).toBeNull();
  });

  it("ACCEPTED — contact visible for both sides", () => {
    expect(canRevealMatchContact("ACCEPTED")).toBe(true);
    const r = revealContactsForMatch({
      status: "ACCEPTED",
      business,
      freelancer,
    });
    expect(r.revealed).toBe(true);
    expect(r.business.email).toBe("biz@example.com");
    expect(r.business.phone).toBe("+91 90000 00001");
    expect(r.freelancer.email).toBe("pro@example.com");
    expect(r.freelancer.phone).toBe("+91 90000 00002");
  });

  it("DECLINED — no contact visible", () => {
    const r = revealContactsForMatch({
      status: "DECLINED",
      business,
      freelancer,
    });
    expect(r.revealed).toBe(false);
    expect(r.freelancer.email).toBeNull();
    expect(r.business.email).toBeNull();
  });

  it("WITHDRAWN — no contact visible", () => {
    const r = revealContactsForMatch({
      status: "WITHDRAWN",
      business,
      freelancer,
    });
    expect(r.revealed).toBe(false);
    expect(r.freelancer.email).toBeNull();
  });

  it("freelancer falls back to User.email when override unset", () => {
    const contact = resolveFreelancerContact({
      contactEmail: null,
      contactPhone: null,
      userEmail: "user@example.com",
    });
    expect(contact.email).toBe("user@example.com");
    expect(contact.phone).toBeNull();
  });

  it("public freelancer page never exposes contact", () => {
    const c = publicFreelancerViewContact();
    expect(c.email).toBeNull();
    expect(c.phone).toBeNull();
  });

  it("unknown / null status never reveals", () => {
    expect(canRevealMatchContact(null)).toBe(false);
    expect(canRevealMatchContact("")).toBe(false);
    expect(canRevealMatchContact("accepted")).toBe(false); // case-sensitive enum
  });
});

describe("keyword matching", () => {
  it("scores logo skill against logo gig", () => {
    const score = scoreGigFreelancerMatch(
      {
        id: "g1",
        title: "Logo design",
        description: "Need a logo designed",
        skillNeeded: "logo design",
        category: "design",
        location: "remote",
      },
      {
        id: "f1",
        slug: "designer",
        summary: "Brand designer",
        skills: ["logo design", "branding"],
        location: "remote",
        availability: "weekdays",
      }
    );
    expect(score.score).toBeGreaterThan(0);
    expect(score.reasons.some((r) => r.includes("skill"))).toBe(true);
  });

  it("ranks matching freelancers first", () => {
    const ranked = rankFreelancersForGig(
      {
        id: "g1",
        title: "Delivery help",
        description: "Need someone for deliveries",
        skillNeeded: "delivery",
        category: "logistics",
        location: "Pune",
      },
      [
        {
          id: "f-writer",
          slug: "writer",
          summary: "I write novels",
          skills: ["writing"],
          location: "Delhi",
          availability: null,
        },
        {
          id: "f-driver",
          slug: "driver",
          summary: "Local delivery driver",
          skills: ["delivery", "driving"],
          location: "Pune",
          availability: "weekends",
        },
      ],
      5
    );
    expect(ranked[0]?.id).toBe("f-driver");
  });
});
