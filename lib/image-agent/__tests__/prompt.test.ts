import { describe, expect, it } from "vitest";

import { buildCharacterAvatarPrompt, buildStoryCoverPrompt } from "@/lib/image-agent/prompt";

describe("buildCharacterAvatarPrompt", () => {
  it("includes core character fields in the prompt", () => {
    const prompt = buildCharacterAvatarPrompt({
      name: "Aria Nightshade",
      age: 27,
      gender: "female",
      role: "protagonist",
      personality: "Fierce and witty, but secretly anxious.",
      appearance: "Silver hair, violet eyes, a scar over one brow.",
      background: "Raised by exiled mages in the northern wastes.",
      speakingStyle: "Sarcastic, clipped sentences.",
    });

    expect(prompt).toContain("Aria Nightshade");
    expect(prompt).toContain("protagonist");
    expect(prompt).toContain("Age: 27");
    expect(prompt).toContain("Gender: female");
    expect(prompt).toContain("Fierce and witty");
    expect(prompt).toContain("Silver hair");
    expect(prompt).toContain("Sarcastic, clipped sentences");
    expect(prompt).toContain("Raised by exiled mages");
    expect(prompt.toLowerCase()).toContain("portrait");
  });

  it("omits optional fields that are null without breaking the prompt", () => {
    const prompt = buildCharacterAvatarPrompt({
      name: "Unknown Soldier",
      age: null,
      gender: null,
      role: "extra",
      personality: "Silent and stoic.",
      appearance: null,
      background: null,
      speakingStyle: null,
    });

    expect(prompt).toContain("Unknown Soldier");
    expect(prompt).toContain("Silent and stoic");
    expect(prompt).not.toContain("Age:");
    expect(prompt).not.toContain("Gender:");
    expect(prompt).not.toContain("Appearance:");
    expect(prompt).not.toContain("Speaking style:");
    expect(prompt).not.toContain("Background:");
  });

  it("truncates very long free-text fields", () => {
    const longAppearance = "x".repeat(2000);
    const prompt = buildCharacterAvatarPrompt({
      name: "Verbose Villain",
      role: "antagonist",
      personality: "Overly detailed.",
      appearance: longAppearance,
    });

    expect(prompt.length).toBeLessThan(longAppearance.length);
    expect(prompt).toContain("…");
  });
});

describe("buildStoryCoverPrompt", () => {
  it("includes core story fields in the prompt", () => {
    const prompt = buildStoryCoverPrompt({
      title: "The Glass Kingdom",
      genre: "fantasy",
      tone: "dark and hopeful",
      setting: "A shattered empire held together by magic.",
      currentSummary: "A young queen must reunite three broken realms.",
      description: null,
    });

    expect(prompt).toContain("The Glass Kingdom");
    expect(prompt).toContain("fantasy");
    expect(prompt).toContain("dark and hopeful");
    expect(prompt).toContain("shattered empire");
    expect(prompt).toContain("reunite three broken realms");
    expect(prompt.toLowerCase()).toContain("cover");
    expect(prompt.toLowerCase()).toContain("no text or typography");
  });

  it("falls back to description when currentSummary is absent", () => {
    const prompt = buildStoryCoverPrompt({
      title: "Static",
      genre: "sci-fi",
      currentSummary: null,
      description: "A lone signal from a dead planet.",
    });

    expect(prompt).toContain("A lone signal from a dead planet.");
  });

  it("omits optional fields that are missing", () => {
    const prompt = buildStoryCoverPrompt({
      title: "Bare Bones",
      genre: "mystery",
    });

    expect(prompt).not.toContain("Tone:");
    expect(prompt).not.toContain("Setting:");
    expect(prompt).not.toContain("Story summary:");
  });
});
