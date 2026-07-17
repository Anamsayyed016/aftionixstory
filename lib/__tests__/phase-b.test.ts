import { describe, expect, it } from "vitest";

import { slugifyTitle, withSlugSuffix } from "@/lib/utils/slug";
import { getPlanLimits } from "@/lib/plans";
import {
  createStoryWizardSchema,
  createRelationshipSchema,
  characterInputSchema,
} from "@/lib/validations/story";

describe("slugifyTitle", () => {
  it("normalizes titles", () => {
    expect(slugifyTitle("Forbidden Hearts")).toBe("forbidden-hearts");
    expect(slugifyTitle("  Hello!!! World  ")).toBe("hello-world");
  });

  it("falls back when empty", () => {
    expect(slugifyTitle("!!!")).toBe("story");
  });

  it("adds numeric suffixes", () => {
    expect(withSlugSuffix("forbidden-hearts", 1)).toBe("forbidden-hearts");
    expect(withSlugSuffix("forbidden-hearts", 2)).toBe("forbidden-hearts-2");
  });
});

describe("plan limits", () => {
  it("returns free defaults", () => {
    expect(getPlanLimits("FREE").maxStories).toBe(3);
    expect(getPlanLimits("FREE").maxActiveCharactersPerStory).toBe(15);
    expect(getPlanLimits("FREE").generationLimit).toBe(20);
  });

  it("returns writer limits", () => {
    expect(getPlanLimits("WRITER").maxStories).toBe(25);
    expect(getPlanLimits("WRITER").generationLimit).toBe(300);
  });
});

describe("story validation", () => {
  it("requires at least one character for create", () => {
    const parsed = createStoryWizardSchema.safeParse({
      title: "My Story",
      genre: "Romance",
      language: "English",
      visibility: "PRIVATE",
      characters: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects self relationships", () => {
    const parsed = createRelationshipSchema.safeParse({
      sourceCharacterId: "a",
      targetCharacterId: "a",
      relationshipType: "rivals",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid character input", () => {
    const parsed = characterInputSchema.safeParse({
      name: "Azar",
      role: "Protagonist",
      personality: "Quiet and loyal",
    });
    expect(parsed.success).toBe(true);
  });
});
