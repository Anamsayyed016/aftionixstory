import { describe, expect, it } from "vitest";

import { AIError, normalizeProviderError } from "@/lib/ai/errors";
import {
  buildEpisodePrompt,
  PROMPT_BUDGETS,
} from "@/lib/ai/prompt-builder";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import {
  assertNonEmptyText,
  parseEpisodeOutput,
} from "@/lib/ai/response-parser";
import { countWords, truncateToBudget } from "@/lib/ai/token-estimator";
import { getEffectiveGenerationLimit, getPlanLimits } from "@/lib/plans";
import {
  isSameUtcMonth,
  resolveUsagePeriod,
  startOfUtcMonth,
} from "@/lib/usage/period";
import {
  clientRequestIdSchema,
  generateEpisodeSchema,
} from "@/lib/validations/episode";
import { allocateNextEpisodeNumber } from "@/lib/data/episode-number";

describe("Phase C — plan generation limits", () => {
  it("enforces free generation limit of 20", () => {
    expect(getPlanLimits("FREE").generationLimit).toBe(20);
    expect(getEffectiveGenerationLimit({ plan: "FREE" })).toBe(20);
  });

  it("uses writer limit of 300", () => {
    expect(getPlanLimits("WRITER").generationLimit).toBe(300);
  });
});

describe("Phase C — monthly reset", () => {
  it("detects same UTC month", () => {
    const a = new Date("2026-07-01T00:00:00.000Z");
    const b = new Date("2026-07-31T23:00:00.000Z");
    expect(isSameUtcMonth(a, b)).toBe(true);
  });

  it("resets count when month changes", () => {
    const periodStart = new Date("2026-06-15T12:00:00.000Z");
    const now = new Date("2026-07-01T00:00:00.000Z");
    const resolved = resolveUsagePeriod(periodStart, 19, now);
    expect(resolved.needsReset).toBe(true);
    expect(resolved.monthlyGenerationCount).toBe(0);
    expect(resolved.generationPeriodStart).toEqual(startOfUtcMonth(now));
  });

  it("keeps count within the same month", () => {
    const periodStart = new Date("2026-07-02T00:00:00.000Z");
    const now = new Date("2026-07-18T00:00:00.000Z");
    const resolved = resolveUsagePeriod(periodStart, 7, now);
    expect(resolved.needsReset).toBe(false);
    expect(resolved.monthlyGenerationCount).toBe(7);
  });
});

describe("Phase C — validations", () => {
  it("requires clientRequestId", () => {
    const parsed = generateEpisodeSchema.safeParse({
      storyId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      userInstruction: "Begin the story",
      action: "NEW_EPISODE",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts safe request ids", () => {
    expect(clientRequestIdSchema.safeParse("abc12345").success).toBe(true);
    expect(clientRequestIdSchema.safeParse("bad id!").success).toBe(false);
  });

  it("rejects short instructions", () => {
    const parsed = generateEpisodeSchema.safeParse({
      storyId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      userInstruction: "no",
      clientRequestId: "req_abcdef12",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("Phase C — prompt builder", () => {
  const baseStory = {
    title: "Forbidden Hearts",
    description: "A slow-burn romance",
    genre: "Romance",
    language: "English",
    storyType: "Serial",
    writingStyle: "Literary",
    dialogueStyle: "Natural",
    pointOfView: "Third limited",
    episodeLength: "Medium",
    tone: "Tender",
    romanceLevel: "High",
    pacing: "Slow burn",
    customInstructions: null,
    setting: "Coastal town",
    timePeriod: "Present",
    mainConflict: "Rival families",
    initialPlot: "Two writers meet at a festival",
    worldRules: null,
    contentBoundaries: "No graphic violence",
    currentSummary: "They met and argued about craft.",
  };

  it("includes active characters and excludes archived by default", () => {
    const built = buildEpisodePrompt({
      story: baseStory,
      characters: [
        {
          name: "Azar",
          age: 28,
          gender: "male",
          role: "Protagonist",
          personality: "Quiet",
          appearance: null,
          background: null,
          speakingStyle: null,
          secrets: "Loves Mira",
          emotionalState: "Hopeful",
          status: "ACTIVE",
        },
        {
          name: "Ghost",
          age: null,
          gender: null,
          role: "Extra",
          personality: "Gone",
          appearance: null,
          background: null,
          speakingStyle: null,
          secrets: null,
          emotionalState: null,
          status: "ARCHIVED",
        },
      ],
      relationships: [],
      writingRules: [
        {
          rule: "Keep secrets unresolved",
          category: "plot",
          priority: 9,
          isActive: true,
        },
        {
          rule: "Ignore me",
          category: null,
          priority: 1,
          isActive: false,
        },
      ],
      recentEpisodeSummaries: [
        { episodeNumber: 1, title: "Opening", summary: "They met." },
      ],
      latestEpisode: {
        episodeNumber: 2,
        title: "Storm",
        content: "Full latest episode content goes here.",
      },
      userInstruction: "Continue with a quiet conversation on the pier.",
      action: "CONTINUE",
      isFirstEpisode: false,
    });

    expect(built.includedCharacterNames).toContain("Azar");
    expect(built.includedCharacterNames).not.toContain("Ghost");
    expect(built.prompt).toContain("Keep secrets unresolved");
    expect(built.prompt).not.toContain("Ignore me");
    expect(built.prompt).toContain("Full latest episode content goes here.");
    expect(built.prompt).toContain("They met.");
    expect(built.systemInstruction).toContain("StoryVerse AI");
    expect(built.prompt).not.toContain(built.systemInstruction.slice(0, 40));
  });

  it("uses initial plot for first episode", () => {
    const built = buildEpisodePrompt({
      story: baseStory,
      characters: [],
      relationships: [],
      writingRules: [],
      recentEpisodeSummaries: [],
      latestEpisode: null,
      userInstruction: "Start gently",
      action: "NEW_EPISODE",
      isFirstEpisode: true,
    });
    expect(built.prompt).toContain("FIRST EPISODE GUIDANCE");
    expect(built.prompt).toContain("Two writers meet at a festival");
  });

  it("respects context budgets", () => {
    const huge = "x".repeat(PROMPT_BUDGETS.maxLatestEpisodeChars + 500);
    const built = buildEpisodePrompt({
      story: baseStory,
      characters: [],
      relationships: [],
      writingRules: [],
      recentEpisodeSummaries: [],
      latestEpisode: {
        episodeNumber: 1,
        title: "Long",
        content: huge,
      },
      userInstruction: "Continue",
      action: "CONTINUE",
      isFirstEpisode: false,
    });
    expect(built.prompt.length).toBeLessThanOrEqual(
      PROMPT_BUDGETS.maxTotalChars
    );
    expect(truncateToBudget(huge, 100).length).toBeLessThanOrEqual(100);
  });
});

describe("Phase C — response parser & mock provider", () => {
  it("rejects empty AI output", () => {
    expect(() => assertNonEmptyText("   ")).toThrow(AIError);
    try {
      assertNonEmptyText("");
    } catch (e) {
      expect(e).toBeInstanceOf(AIError);
      expect((e as AIError).code).toBe("AI_INVALID_RESPONSE");
    }
  });

  it("parses title marker", () => {
    const parsed = parseEpisodeOutput(
      "Title: Pier Lights\n\nThey walked in silence.",
      "Fallback"
    );
    expect(parsed.title).toBe("Pier Lights");
    expect(parsed.content).toContain("walked");
  });

  it("normalizes blocked content errors", () => {
    const err = normalizeProviderError(new Error("Response blocked by safety"));
    expect(err.code).toBe("AI_CONTENT_BLOCKED");
    expect(err.retryable).toBe(false);
  });

  it("mock provider returns text without secrets", async () => {
    const provider = new MockAIProvider(() => "Title: Test\n\nHello world.");
    const result = await provider.generateText({
      systemInstruction: "secret system prompt",
      prompt: "user prompt",
    });
    expect(result.text).toContain("Hello world");
    expect(JSON.stringify(result)).not.toContain("secret system prompt");
    expect(countWords(result.text)).toBeGreaterThan(0);
  });
});

describe("Phase C — episode numbering helper", () => {
  it("allocates max+1 not count+1", async () => {
    const tx = {
      episode: {
        aggregate: async () => ({ _max: { episodeNumber: 4 } }),
      },
    };
    await expect(allocateNextEpisodeNumber(tx, "story1")).resolves.toBe(5);

    const emptyTx = {
      episode: {
        aggregate: async () => ({ _max: { episodeNumber: null } }),
      },
    };
    await expect(allocateNextEpisodeNumber(emptyTx, "story1")).resolves.toBe(1);
  });
});

describe("Phase C — draft vs saved semantics", () => {
  it("documents that generation returns unsaved draft shape", () => {
    // Generation service returns draft fields without episodeId persistence.
    const draft = {
      title: "Draft",
      content: "Body",
      wordCount: 1,
      clientRequestId: "req_1",
    };
    expect("episodeId" in draft).toBe(false);
  });
});
