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

describe("business profile multi-turn accumulation (bug regression)", () => {
  it("progresses through the exact reported conversation without re-asking name blindly", () => {
    // Turn 1: starter → empty prior
    let state: unknown = {};
    let prior = readBusinessDraftFromState(state);

    // Turn 2: informal details
    const turn2 = extractBusinessDraft(
      "software developer, hoor, anamsayyed58@gmail.com"
    );
    prior = mergeBusinessDrafts(prior, turn2);
    state = withBusinessDraftInState(state, prior);

    expect(prior.name?.toLowerCase()).toBe("hoor");
    expect(prior.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(missingBusinessFields(prior)).toContain("location");
    expect(missingBusinessFields(prior)).not.toContain("business name");

    // Turn 3: follow-up with location (and redundant name)
    const turn3 = extractBusinessDraft("name - hoor, location- banswara");
    prior = mergeBusinessDrafts(
      readBusinessDraftFromState(state),
      turn3
    );
    state = withBusinessDraftInState(state, prior);

    expect(prior.name?.toLowerCase()).toBe("hoor");
    expect(prior.location?.toLowerCase()).toBe("banswara");
    expect(prior.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(missingBusinessFields(prior)).toEqual([]);
  });

  it("keeps earlier email when later message only adds location", () => {
    const merged = mergeBusinessDrafts(
      { name: "hoor", contactEmail: "anamsayyed58@gmail.com", category: "software developer" },
      extractBusinessDraft("location - banswara")
    );
    expect(merged.contactEmail).toBe("anamsayyed58@gmail.com");
    expect(merged.location?.toLowerCase()).toBe("banswara");
    expect(missingBusinessFields(merged)).toEqual([]);
  });
});
