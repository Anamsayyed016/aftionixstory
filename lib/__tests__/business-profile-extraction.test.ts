import { describe, expect, it } from "vitest";

import {
  extractBusinessDraft,
  mergeBusinessDrafts,
  missingBusinessFields,
  readBusinessDraftFromState,
  withBusinessDraftInState,
} from "@/lib/business-agent/extract";

describe("extractBusinessDraft — informal free text", () => {
  it("parses comma list: category, name, email", () => {
    const d = extractBusinessDraft(
      "software developer, hoor, anamsayyed58@gmail.com"
    );
    expect(d.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(d.name?.toLowerCase()).toBe("hoor");
    expect(d.category?.toLowerCase()).toContain("software");
  });

  it("parses labeled fields with dashes", () => {
    const d = extractBusinessDraft("name - hoor, location- banswara");
    expect(d.name?.toLowerCase()).toBe("hoor");
    expect(d.location?.toLowerCase()).toBe("banswara");
  });

  it("parses labeled email and category", () => {
    const d = extractBusinessDraft(
      "name: Bright Print, category - printing, email - hello@brightprint.example"
    );
    expect(d.name).toMatch(/Bright Print/i);
    expect(d.category).toMatch(/printing/i);
    expect(d.contactEmail).toBe("hello@brightprint.example");
  });
});

describe("extractBusinessDraft — meta listing prompts must not invent fields", () => {
  it("returns empty for the exact studio starter prompt", () => {
    const d = extractBusinessDraft(
      "List my business on the directory. I'll share the name, what we do, location, and contact email."
    );
    expect(d).toEqual({});
  });

  it("returns empty for short list-my-business intent", () => {
    expect(extractBusinessDraft("List my business on the directory")).toEqual(
      {}
    );
    expect(
      extractBusinessDraft("I want to list my business, I'll share details")
    ).toEqual({});
  });

  it("rejects junk location tokens like Ads", () => {
    const d = extractBusinessDraft(
      "name - Aftionix, category - digital marketing, location - Ads"
    );
    expect(d.name).toMatch(/Aftionix/i);
    expect(d.category).toMatch(/digital marketing/i);
    expect(d.location).toBeUndefined();
  });

  it("does not take Ads as the business name from a comma list", () => {
    const d = extractBusinessDraft("Aftionix, digital marketing, Ads");
    expect(d.name?.toLowerCase()).not.toBe("ads");
    expect(d.location?.toLowerCase()).not.toBe("ads");
  });
});

describe("business profile multi-turn accumulation (bug regression)", () => {
  it("progresses through the exact reported conversation without re-asking name blindly", () => {
    let state: unknown = {};
    let prior = readBusinessDraftFromState(state);

    const turn2 = extractBusinessDraft(
      "software developer, hoor, anamsayyed58@gmail.com"
    );
    prior = mergeBusinessDrafts(prior, turn2);
    state = withBusinessDraftInState(state, prior);

    expect(prior.name?.toLowerCase()).toBe("hoor");
    expect(prior.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(missingBusinessFields(prior)).toContain("location");
    expect(missingBusinessFields(prior)).not.toContain("business name");

    const turn3 = extractBusinessDraft("name - hoor, location- banswara");
    prior = mergeBusinessDrafts(readBusinessDraftFromState(state), turn3);
    state = withBusinessDraftInState(state, prior);

    expect(prior.name?.toLowerCase()).toBe("hoor");
    expect(prior.location?.toLowerCase()).toBe("banswara");
    expect(prior.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(missingBusinessFields(prior)).toEqual([]);
  });

  it("keeps earlier email when later message only adds location", () => {
    const merged = mergeBusinessDrafts(
      {
        name: "hoor",
        contactEmail: "anamsayyed58@gmail.com",
        category: "software developer",
      },
      extractBusinessDraft("location - banswara")
    );
    expect(merged.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(merged.location?.toLowerCase()).toBe("banswara");
    expect(missingBusinessFields(merged)).toEqual([]);
  });
});
