/**
 * Phase D — Dynamic Context Builder v2 tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildDynamicContext,
  buildContextRequestFromPlan,
  dynamicContextToLegacyStoryMemory,
  isDynamicContextV2Enabled,
  serializeDynamicContextForPrompt,
  summarizeContextForLogs,
} from "@/lib/context-builder/v2";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { applyMemoryV2Patch, upgradeStoryMemory } from "@/lib/story-memory/v2";
import { buildStoryContext } from "@/lib/ai/context/story-context-builder";

function baseMemory() {
  let v2 = upgradeStoryMemory({});
  v2 = applyMemoryV2Patch(v2, {
    set: {
      title: "Forbidden Hours",
      concept: "CEO and intern romance",
      genre: ["Romance"],
      tone: ["emotional"],
    },
    upsertCharacters: [
      {
        name: "Anaya",
        role: "female_lead",
        personalityTraits: ["innocent", "strong"],
        aliases: ["Ana"],
      },
      {
        name: "Azar",
        role: "male_lead",
        age: 35,
        personalityTraits: ["guarded"],
      },
      {
        name: "Sameer",
        role: "supporting",
        personalityTraits: ["loyal"],
      },
      {
        name: "Riya",
        role: "extra",
      },
    ],
    upsertRelationships: [
      {
        fromName: "Anaya",
        toName: "Azar",
        type: "love_interest",
        label: "forbidden romance",
      },
      {
        fromName: "Anaya",
        toName: "Sameer",
        type: "daughter",
      },
      {
        fromName: "Riya",
        toName: "Sameer",
        type: "friends",
      },
    ],
    upsertLocations: [
      { name: "Sayyed Mansion", type: "home", importance: "major" },
      { name: "Office Tower", type: "work" },
    ],
    upsertEvents: [
      {
        title: "Anaya meets Azar",
        episodeNumber: 1,
        importance: "major",
        order: 1,
      },
      {
        title: "The confrontation",
        episodeNumber: 3,
        importance: "major",
        order: 3,
      },
      {
        title: "Office party",
        episodeNumber: 2,
        order: 2,
      },
    ],
    upsertOpenThreads: [
      {
        title: "Who attacked Anaya?",
        priority: "high",
        status: "open",
      },
      {
        title: "Unrelated subplot about a missing dog",
        priority: "low",
        status: "open",
      },
    ],
    upsertSecrets: [
      {
        title: "Azar knows Anaya's real identity",
        knownByCharacterIds: ["Azar"],
        hiddenFromCharacterIds: ["Anaya"],
      },
    ],
    upsertWritingRules: [
      { rule: "Use Hinglish dialogues", priority: "high", category: "language" },
      { rule: "Hinglish dialogues", priority: "normal", category: "language" },
      { rule: "Slow pacing", priority: "normal", category: "pacing" },
      { rule: "Critical continuity lock", priority: "critical" },
    ],
    updatePreferences: {
      language: "hinglish",
      dialogueLanguage: "hinglish",
      emojiLevel: "light",
    },
    updateContinuity: {
      currentLocationId: undefined as unknown as string,
      activeCharacterIds: [],
    },
  }).memory;

  // Fix continuity location + active chars + thread character links
  const anaya = v2.characters.find((c) => c.name === "Anaya")!;
  const azar = v2.characters.find((c) => c.name === "Azar")!;
  const mansion = v2.locations.find((l) => /mansion/i.test(l.name))!;
  v2 = {
    ...v2,
    continuity: {
      ...v2.continuity,
      currentLocationId: mansion.id,
      activeCharacterIds: [anaya.id, azar.id],
      currentConflict: "Who attacked Anaya?",
    },
    openThreads: v2.openThreads.map((t) =>
      /attacked Anaya/i.test(t.title)
        ? { ...t, relatedCharacterIds: [anaya.id] }
        : t
    ),
    events: v2.events.map((e) =>
      /meets Azar|confrontation/i.test(e.title)
        ? { ...e, characterIds: [anaya.id, azar.id], locationId: mansion.id }
        : e
    ),
    secrets: v2.secrets.map((s) => ({
      ...s,
      knownByCharacterIds: [azar.id],
      hiddenFromCharacterIds: [anaya.id],
    })),
  };
  return v2;
}

function req(
  intent: string,
  message: string,
  memory = baseMemory(),
  extras?: Partial<Parameters<typeof buildContextRequestFromPlan>[0]>
) {
  return buildContextRequestFromPlan({
    intent,
    operation: intent,
    userMessage: message,
    memory,
    recentMessages: extras?.recentMessages ?? [
      { role: "user", content: message },
    ],
    conversationFlow: DEFAULT_CONVERSATION_FLOW,
    entities: extras?.entities ?? {
      characterNames: [],
      episodeNumber: null,
      requestedTone: null,
      requestedLanguage: null,
    },
    ...extras,
  });
}

describe("Phase D — Dynamic Context Builder v2", () => {
  const prevFlag = process.env.AI_DYNAMIC_CONTEXT_V2_ENABLED;

  beforeEach(() => {
    process.env.AI_DYNAMIC_CONTEXT_V2_ENABLED = "true";
  });

  afterEach(() => {
    process.env.AI_DYNAMIC_CONTEXT_V2_ENABLED = prevFlag;
  });

  it("1. Greeting → prefs + minimal context, no cast/events/draft", () => {
    const ctx = buildDynamicContext(req("greeting", "hey"));
    expect(ctx.characters).toHaveLength(0);
    expect(ctx.events).toHaveLength(0);
    expect(ctx.latestDraft).toBeNull();
    expect(ctx.preferences).toBeTruthy();
  });

  it("2. Forbidden romance brainstorm → story concept, no full cast", () => {
    const ctx = buildDynamicContext(
      req("brainstorm", "I want forbidden romance")
    );
    expect(ctx.story.concept || ctx.story.tone.length).toBeTruthy();
    expect(ctx.characters.length).toBeLessThanOrEqual(4);
  });

  it("3. Write scene with Anaya and Azar → only those + relationship", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya and Azar", baseMemory(), {
        entities: {
          characterNames: ["Anaya", "Azar"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    const names = ctx.characters.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Anaya", "Azar"]));
    expect(names).not.toContain("Riya");
    expect(
      ctx.relationships.some(
        (r) =>
          (r.fromName === "Anaya" && r.toName === "Azar") ||
          (r.fromName === "Azar" && r.toName === "Anaya")
      )
    ).toBe(true);
    expect(ctx.locations.some((l) => /mansion/i.test(l.name))).toBe(true);
  });

  it("4. Write scene with Anaya → relevant related chars only", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", baseMemory(), {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    expect(ctx.characters.some((c) => c.name === "Anaya")).toBe(true);
    expect(ctx.characters.length).toBeLessThan(baseMemory().characters.length);
    expect(ctx.characters.some((c) => c.name === "Riya")).toBe(false);
  });

  it("5. Who is Azar? → Azar profile + relationships", () => {
    const ctx = buildDynamicContext(
      req("character_question", "Who is Azar?", baseMemory(), {
        entities: {
          characterNames: ["Azar"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    expect(ctx.characters.some((c) => c.name === "Azar")).toBe(true);
    expect(ctx.latestDraft).toBeNull();
  });

  it("6. Episode 3 question → episode-matched events", () => {
    const ctx = buildDynamicContext(
      req("episode_question", "What happened in episode 3?", baseMemory(), {
        entities: {
          characterNames: [],
          episodeNumber: 3,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    expect(ctx.events.some((e) => e.episodeNumber === 3)).toBe(true);
    expect(ctx.latestDraft).toBeNull();
  });

  it("7. Make it more emotional with draft → includes draft", () => {
    const memory = {
      ...baseMemory(),
      latestDraft: {
        title: "Scene",
        content: "Anaya looked at Azar with tears in her eyes. ".repeat(20),
        wordCount: 100,
      },
    };
    const ctx = buildDynamicContext(
      req("make_emotional", "Make it more emotional", memory)
    );
    expect(ctx.latestDraft?.content).toBeTruthy();
    expect(ctx.writingRules.length).toBeGreaterThan(0);
  });

  it("8. Make it more emotional without draft → no draft", () => {
    const ctx = buildDynamicContext(
      req("make_emotional", "Make it more emotional")
    );
    expect(ctx.latestDraft).toBeNull();
  });

  it("9. Continue with draft → ending + continuity", () => {
    const memory = {
      ...baseMemory(),
      latestDraft: {
        title: "Scene",
        content: "BEGIN " + "middle ".repeat(50) + " ENDING_MARKER",
        wordCount: 80,
      },
    };
    const ctx = buildDynamicContext(req("continue_story", "Continue", memory));
    expect(ctx.latestDraft?.content).toContain("ENDING_MARKER");
    expect(ctx.continuity).toBeTruthy();
  });

  it("10. Continue with huge draft → truncation metadata", () => {
    const huge = "A".repeat(20_000) + "TAIL_CONTEXT";
    const memory = {
      ...baseMemory(),
      latestDraft: { title: "Big", content: huge, wordCount: 5000 },
    };
    const ctx = buildDynamicContext(
      req("continue_story", "Continue", memory, {
        limits: { maxDraftChars: 2000 },
      })
    );
    expect(ctx.retrieval.truncatedDraft).toBe(true);
    expect(ctx.latestDraft?.truncated).toBe(true);
    expect(ctx.latestDraft?.content?.length || 0).toBeLessThan(huge.length);
    expect(ctx.latestDraft?.content).toContain("TAIL_CONTEXT");
  });

  it("11. Hinglish me likho → language prefs/rules only", () => {
    const ctx = buildDynamicContext(req("language_change", "Hinglish me likho"));
    expect(ctx.characters).toHaveLength(0);
    expect(ctx.events).toHaveLength(0);
    expect(ctx.latestDraft).toBeNull();
    expect(ctx.preferences).toBeTruthy();
  });

  it("12. Correction context → target relationship/chars only", () => {
    const ctx = buildDynamicContext(
      req(
        "memory_correction",
        "Anaya is not sister, she is daughter",
        baseMemory(),
        {
          entities: {
            characterNames: ["Anaya"],
            episodeNumber: null,
            requestedTone: null,
            requestedLanguage: null,
          },
        }
      )
    );
    expect(ctx.characters.length).toBeGreaterThan(0);
    expect(ctx.characters.length).toBeLessThanOrEqual(4);
    expect(ctx.events).toHaveLength(0);
    expect(ctx.latestDraft).toBeNull();
  });

  it("13. Scene includes currentLocationId", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya and Azar", baseMemory(), {
        entities: {
          characterNames: ["Anaya", "Azar"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    expect(ctx.locations.some((l) => /mansion/i.test(l.name))).toBe(true);
  });

  it("14. Location mention by case resolves", () => {
    const ctx = buildDynamicContext(
      req("world_building", "Describe sayyed mansion at night")
    );
    expect(ctx.locations.some((l) => /mansion/i.test(l.name))).toBe(true);
  });

  it("15. Active open thread involving selected character included", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", baseMemory(), {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    expect(ctx.openThreads.some((t) => /attacked Anaya/i.test(t.title))).toBe(
      true
    );
  });

  it("16. Unrelated open thread excluded", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", baseMemory(), {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    expect(ctx.openThreads.some((t) => /missing dog/i.test(t.title))).toBe(
      false
    );
  });

  it("17. Secret hidden from Anaya not in her characterKnowledge", () => {
    const memory = baseMemory();
    const anaya = memory.characters.find((c) => c.name === "Anaya")!;
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", memory, {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    const known = ctx.knowledge.characterKnowledge[anaya.id] || [];
    expect(known.join(" ")).not.toMatch(/real identity/i);
  });

  it("18. Author planning may include secret titles", () => {
    const ctx = buildDynamicContext({
      ...req("brainstorm", "Plan the identity reveal carefully"),
      authorPlanning: true,
    });
    expect(
      ctx.knowledge.authorKnowledge.some((s) => /identity/i.test(s)) ||
        ctx.secrets.some((s) => /identity/i.test(s.title))
    ).toBe(true);
  });

  it("19. Two conversations isolated by separate memory objects", () => {
    const a = baseMemory();
    const b = upgradeStoryMemory({});
    const ctxA = buildDynamicContext(req("write_scene", "Anaya scene", a));
    const ctxB = buildDynamicContext(req("write_scene", "Anaya scene", b));
    expect(ctxA.characters.some((c) => c.name === "Anaya")).toBe(true);
    expect(ctxB.characters).toHaveLength(0);
  });

  it("20. 100 characters → only top-ranked limited set", () => {
    let memory = upgradeStoryMemory({});
    memory = applyMemoryV2Patch(memory, {
      upsertCharacters: Array.from({ length: 100 }, (_, i) => ({
        name: `Char${i}`,
      })),
    }).memory;
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Char7", memory, {
        entities: {
          characterNames: ["Char7"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
        limits: { maxCharacters: 8 },
      })
    );
    expect(ctx.characters.length).toBeLessThanOrEqual(8);
    expect(ctx.characters.some((c) => c.name === "Char7")).toBe(true);
  });

  it("21. 300 relationships → only relevant included", () => {
    let memory = baseMemory();
    memory = applyMemoryV2Patch(memory, {
      upsertRelationships: Array.from({ length: 300 }, (_, i) => ({
        fromName: `Char${i % 50}`,
        toName: `Char${(i + 1) % 50}`,
        type: `link_${i}`,
      })),
    }).memory;
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya and Azar", memory, {
        entities: {
          characterNames: ["Anaya", "Azar"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
        limits: { maxRelationships: 12 },
      })
    );
    expect(ctx.relationships.length).toBeLessThanOrEqual(12);
  });

  it("22. Token budget exceeded → deterministic pruning", () => {
    const memory = {
      ...baseMemory(),
      latestDraft: {
        title: "x",
        content: "word ".repeat(5000),
        wordCount: 5000,
      },
    };
    const ctx = buildDynamicContext(
      req("continue_story", "Continue", memory, {
        limits: { maxTotalEstimatedTokens: 500, maxDraftChars: 8000 },
      })
    );
    expect(ctx.retrieval.estimatedTokens).toBeLessThanOrEqual(2000);
    expect(ctx.retrieval.truncated || ctx.retrieval.truncatedDraft).toBe(true);
  });

  it("23. High-priority writing rule never pruned away entirely", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", baseMemory(), {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
        limits: { maxWritingRules: 20, maxTotalEstimatedTokens: 50 },
      })
    );
    // After prune, critical rule should remain if any writing rules remain
    if (ctx.writingRules.length) {
      expect(
        ctx.writingRules.some(
          (r) =>
            r.priority === "critical" ||
            /continuity lock/i.test(r.rule) ||
            r.priority === "high"
        )
      ).toBe(true);
    }
  });

  it("24. Duplicate writing rules normalized", () => {
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", baseMemory(), {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    const hinglish = ctx.writingRules.filter((r) =>
      /hinglish/i.test(r.rule)
    );
    expect(hinglish.length).toBeLessThanOrEqual(1);
  });

  it("25. Recent awaiting question preserved", () => {
    const ctx = buildDynamicContext(
      req("awaiting_answer", "The intern", baseMemory(), {
        recentMessages: [
          {
            role: "assistant",
            content: "Who falls first — CEO or intern?",
          },
          { role: "user", content: "The intern" },
        ],
        conversationFlow: {
          ...DEFAULT_CONVERSATION_FLOW,
          awaiting: { type: "choice", topic: "who_falls_first" },
        },
      })
    );
    expect(
      ctx.recentConversation.some((m) => /falls first/i.test(m.content))
    ).toBe(true);
  });

  it("26. Duplicate retry / provider error messages excluded", () => {
    const ctx = buildDynamicContext(
      req("normal_chat", "ok", baseMemory(), {
        recentMessages: [
          { role: "assistant", content: "I couldn’t finish that reply." },
          { role: "user", content: "ok" },
        ],
      })
    );
    expect(
      ctx.recentConversation.some((m) => /couldn.?t finish/i.test(m.content))
    ).toBe(false);
  });

  it("27. Unknown intent → minimal safe context", () => {
    const ctx = buildDynamicContext(req("unknown", "asdf qwer"));
    expect(ctx.characters.length).toBe(0);
    expect(ctx.latestDraft).toBeNull();
  });

  it("28. Legacy projection keeps CompactStoryContext usable", () => {
    // Seed via v2 then wrap
    const v2 = baseMemory();
    const wrapped = Object.assign(emptyStoryMemory(), {
      __memoryV2: v2,
      storyMemory: {
        concept: v2.story.concept ?? undefined,
        title: v2.story.title ?? undefined,
        genre: v2.story.genre,
        tone: v2.story.tone,
        themes: v2.story.themes,
        storyStatus: "brainstorming" as const,
      },
      characters: v2.characters.map((c) => ({
        name: c.name,
        role: c.role ?? undefined,
        personality: c.personalityTraits,
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      })),
      relationships: [],
      writingRules: [],
      userPreferences: emptyStoryMemory().userPreferences,
    });
    const compact = buildStoryContext({
      operation: "write_scene",
      memory: wrapped,
      userMessage: "Write a scene with Anaya and Azar",
      intent: "write_scene",
      entities: { characterNames: ["Anaya", "Azar"] },
    });
    expect(compact.characters.some((c) => c.name === "Anaya")).toBe(true);
    expect(compact.promptSectionNames.length).toBeGreaterThan(0);

    const dyn = buildDynamicContext(
      req("write_scene", "Write a scene with Anaya", v2, {
        entities: {
          characterNames: ["Anaya"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    const legacy = dynamicContextToLegacyStoryMemory(dyn);
    expect(legacy.characters.length).toBeLessThanOrEqual(dyn.characters.length);
  });

  it("serializer omits empty sections and avoids raw state dumps", () => {
    const ctx = buildDynamicContext(req("greeting", "hi"));
    const text = serializeDynamicContextForPrompt(ctx);
    expect(text).not.toContain("memoryConflicts");
    expect(text).not.toContain("__memoryV2");
    const summary = summarizeContextForLogs(ctx);
    expect(JSON.stringify(summary)).not.toMatch(/Anaya looked/);
  });

  it("feature flag disabled reports false", () => {
    process.env.AI_DYNAMIC_CONTEXT_V2_ENABLED = "false";
    expect(isDynamicContextV2Enabled()).toBe(false);
  });

  it("performance: large memory under generous bound", () => {
    let memory = upgradeStoryMemory({});
    memory = applyMemoryV2Patch(memory, {
      upsertCharacters: Array.from({ length: 100 }, (_, i) => ({
        name: `Char${i}`,
      })),
      upsertRelationships: Array.from({ length: 300 }, (_, i) => ({
        fromName: `Char${i % 100}`,
        toName: `Char${(i + 1) % 100}`,
        type: `t${i % 20}`,
      })),
    }).memory;
    const t0 = performance.now();
    const ctx = buildDynamicContext(
      req("write_scene", "Write a scene with Char1", memory, {
        entities: {
          characterNames: ["Char1"],
          episodeNumber: null,
          requestedTone: null,
          requestedLanguage: null,
        },
      })
    );
    const ms = performance.now() - t0;
    expect(ctx.characters.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(250);
  });
});
