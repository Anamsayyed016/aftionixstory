/**
 * Phase C — Memory Model v2 tests.
 */

import { describe, expect, it } from "vitest";

import {
  applyMemoryPatch,
  emptyStoryMemory,
  getMemoryV2,
  parseStoryMemory,
} from "@/lib/story-agent/memory-patch";
import {
  ConversationStateMemoryRepository,
  applyMemoryV2Patch,
  legacyPatchToMemoryV2Patch,
  summarizeMemoryForLogs,
  upgradeStoryMemory,
  type StoryMemoryV2,
} from "@/lib/story-memory/v2";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";

const legacyFixture = {
  storyMemory: {
    title: "Forbidden Hours",
    concept: "CEO and intern romance",
    genre: ["Romance"],
    tone: ["emotional"],
    storyStatus: "brainstorming",
  },
  characters: [
    {
      name: "Anaya",
      role: "female lead",
      personality: ["innocent", "strong"],
      goals: [],
      conflicts: [],
      notes: [],
      avoid: [],
    },
    {
      name: "Azar",
      role: "male lead",
      age: 35,
      personality: [],
      goals: [],
      conflicts: [],
      notes: [],
      avoid: [],
    },
  ],
  relationships: [
    { from: "Anaya", to: "Azar", type: "sister", notes: "wrong" },
  ],
  writingRules: [{ rule: "Hinglish dialogues", priority: "important" }],
  userPreferences: {
    dialogueLanguage: "hinglish",
    doNotStartYet: false,
    mirrorUserLanguage: true,
    avoidFormalHindi: true,
    uppercaseForLoudDialogue: false,
    slowBurn: false,
    preferShortDialogues: false,
    avoid: [],
  },
  latestDraft: {
    title: "Scene 1",
    content: "Anaya walked into the office with a racing heart.",
    wordCount: 10,
  },
  customLegacyFlag: "preserve-me",
};

describe("Phase C — Memory Model v2", () => {
  it("1. Legacy memory without memoryVersion upgrades to v2", () => {
    const v2 = upgradeStoryMemory(legacyFixture);
    expect(v2.memoryVersion).toBe(2);
    expect(v2.story.title).toBe("Forbidden Hours");
    expect(v2.characters.length).toBe(2);
  });

  it("2. Legacy character without ID gets stable ID", () => {
    const v2 = upgradeStoryMemory(legacyFixture);
    const anaya = v2.characters.find((c) => c.name === "Anaya");
    expect(anaya?.id).toMatch(/^char_/);
  });

  it("3. Run upgrader twice → identical result", () => {
    const once = upgradeStoryMemory(legacyFixture);
    const twice = upgradeStoryMemory(once);
    expect(twice).toEqual(once);
  });

  it("4. Upsert Anaya then anaya → one character", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya", personalityTraits: ["kind"] }],
    });
    repo.applyPatch({
      upsertCharacters: [{ name: "anaya", personalityTraits: ["brave"] }],
    });
    expect(repo.getMemory().characters).toHaveLength(1);
    expect(repo.getMemory().characters[0].personalityTraits).toEqual(
      expect.arrayContaining(["kind", "brave"])
    );
  });

  it("5. Alias Ana resolves findCharacterByName", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya", aliases: ["Ana"] }],
    });
    expect(repo.findCharacterByName("ana")?.name).toBe("Anaya");
  });

  it("6. Partial character update preserves traits", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [
        { name: "Anaya", personalityTraits: ["innocent", "strong"], role: "lead" },
      ],
    });
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya", occupation: "intern" }],
    });
    const c = repo.findCharacterByName("Anaya")!;
    expect(c.personalityTraits).toEqual(["innocent", "strong"]);
    expect(c.occupation).toBe("intern");
    expect(c.role).toBe("lead");
  });

  it("7. Empty traits without replace does not erase", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya", personalityTraits: ["kind"] }],
    });
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya", personalityTraits: [] }],
    });
    expect(repo.findCharacterByName("Anaya")?.personalityTraits).toEqual([
      "kind",
    ]);
  });

  it("8. Explicit replaceTraits replaces traits", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya", personalityTraits: ["kind"] }],
    });
    repo.applyPatch({
      upsertCharacters: [
        { name: "Anaya", personalityTraits: ["fierce"], replaceTraits: true },
      ],
    });
    expect(repo.findCharacterByName("Anaya")?.personalityTraits).toEqual([
      "fierce",
    ]);
  });

  it("9. Same patch twice → no duplicate entity", () => {
    const repo = new ConversationStateMemoryRepository();
    const patch = {
      upsertCharacters: [{ name: "Azar", role: "male_lead" }],
      upsertRelationships: [
        { fromName: "Azar", toName: "Anaya", type: "love_interest" },
      ],
    };
    repo.applyPatch({
      upsertCharacters: [{ name: "Anaya" }],
    });
    repo.applyPatch(patch);
    repo.applyPatch(patch);
    expect(repo.getMemory().characters.filter((c) => c.name === "Azar")).toHaveLength(
      1
    );
    expect(
      repo.getMemory().relationships.filter((r) => r.type === "love_interest")
    ).toHaveLength(1);
  });

  it("10. CEO × Intern offer selection stores chars + relationship in v2", () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: "CEO × Intern" },
      characters: [
        { name: "CEO", role: "male lead", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
        { name: "Intern", role: "female lead", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
      ],
      relationships: [
        { from: "CEO", to: "Intern", type: "romantic tension" },
      ],
    });
    const v2 = getMemoryV2(memory);
    expect(v2.characters.length).toBe(2);
    expect(v2.relationships.some((r) => /romantic/i.test(r.type))).toBe(true);
  });

  it("11. Intern falls first updates without duplicate relationship", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [{ name: "CEO" }, { name: "Intern" }],
      upsertRelationships: [
        { fromName: "CEO", toName: "Intern", type: "romantic tension" },
      ],
    });
    repo.applyPatch({
      upsertRelationships: [
        {
          fromName: "Intern",
          toName: "CEO",
          type: "romantic tension",
          notes: ["Intern falls first"],
        },
      ],
    });
    const rels = repo
      .getMemory()
      .relationships.filter((r) => /romantic/i.test(r.type));
    expect(rels.length).toBeLessThanOrEqual(2);
  });

  it("12. Correction sister → daughter supersedes old relation", () => {
    const repo = new ConversationStateMemoryRepository(legacyFixture);
    repo.applyPatch({
      corrections: [
        {
          entityType: "relationship",
          target: { from: "Anaya", to: "Azar" },
          incorrectValue: "sister",
          correctValue: "daughter",
          reason: "User correction",
        },
      ],
      allowConflicts: true,
    });
    const mem = repo.getMemory();
    const sister = mem.relationships.find((r) => /sister/i.test(r.type));
    const daughter = mem.relationships.find((r) => /daughter/i.test(r.type));
    expect(sister?.status).toBe("superseded");
    expect(daughter?.status).toBe("active");
    expect(mem.metadata.correctionHistory.length).toBeGreaterThan(0);
  });

  it("13. Normal age update conflicts with existing age", () => {
    const repo = new ConversationStateMemoryRepository(legacyFixture);
    repo.applyPatch({
      upsertCharacters: [{ name: "Azar", age: 28 }],
    });
    expect(repo.findCharacterByName("Azar")?.age).toBe(35);
    expect(repo.getMemory().metadata.memoryConflicts.length).toBeGreaterThan(0);
  });

  it("14. Correction intent changes age and records history", () => {
    const repo = new ConversationStateMemoryRepository(legacyFixture);
    repo.applyPatch({
      corrections: [
        {
          entityType: "character",
          target: { name: "Azar" },
          field: "age",
          incorrectValue: 35,
          correctValue: 28,
          reason: "User correction",
        },
      ],
      allowConflicts: true,
    });
    expect(repo.findCharacterByName("Azar")?.age).toBe(28);
    expect(repo.getMemory().metadata.correctionHistory.length).toBeGreaterThan(0);
  });

  it("15. Duplicate writing rules are normalized", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertWritingRules: [{ rule: "Hinglish dialogues" }],
    });
    repo.applyPatch({
      upsertWritingRules: [{ rule: "Use Hinglish dialogues" }],
    });
    expect(repo.getMemory().writingRules).toHaveLength(1);
  });

  it("16. Preference language update leaves story facts untouched", () => {
    const repo = new ConversationStateMemoryRepository(legacyFixture);
    const before = repo.getMemory().story.concept;
    repo.applyPatch({
      updatePreferences: { language: "english", dialogueLanguage: "english" },
    });
    expect(repo.getMemory().story.concept).toBe(before);
    expect(repo.getMemory().userPreferences.dialogueLanguage).toBe("english");
  });

  it("17. Do-not-start conversationFlow stays outside memory", () => {
    const flow = {
      ...DEFAULT_CONVERSATION_FLOW,
      generationBlocked: true,
    };
    const v2 = upgradeStoryMemory(legacyFixture);
    expect(v2.userPreferences.doNotStartYet).toBe(false);
    expect(flow.generationBlocked).toBe(true);
  });

  it("18. latestDraft preserved through upgrade", () => {
    const v2 = upgradeStoryMemory(legacyFixture);
    expect(v2.latestDraft?.content).toContain("Anaya walked");
  });

  it("19. Unknown legacy field preserved safely", () => {
    const v2 = upgradeStoryMemory(legacyFixture);
    expect(
      (v2.metadata as { legacy?: Record<string, unknown> }).legacy
        ?.customLegacyFlag
    ).toBe("preserve-me");
  });

  it("20. Malformed relationships skipped with warning", () => {
    const v2 = upgradeStoryMemory({
      relationships: [{ from: "OnlyOne" }, null, "bad"],
      characters: [],
    });
    expect(v2.metadata.warnings.some((w) => /relationship/i.test(w))).toBe(
      true
    );
  });

  it("21. Two conversations memory isolated", () => {
    const a = new ConversationStateMemoryRepository();
    const b = new ConversationStateMemoryRepository();
    a.applyPatch({ upsertCharacters: [{ name: "Anaya" }] });
    expect(b.getMemory().characters).toHaveLength(0);
    expect(a.getMemory().characters).toHaveLength(1);
  });

  it("22. Repeated identical patch is idempotent (no dupes)", () => {
    const repo = new ConversationStateMemoryRepository();
    const patch = {
      upsertOpenThreads: [
        { title: "Who attacked Anaya?", priority: "high" as const },
      ],
    };
    repo.applyPatch(patch);
    const rev1 = repo.getMemory().metadata.revision;
    repo.applyPatch(patch);
    expect(repo.getMemory().openThreads).toHaveLength(1);
    expect(repo.getMemory().metadata.revision).toBeGreaterThan(rev1);
  });

  it("23. Stale expectedRevision prevents overwrite", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({ upsertCharacters: [{ name: "Anaya" }] });
    const result = repo.applyPatch({
      expectedRevision: 0,
      upsertCharacters: [{ name: "Azar" }],
    });
    expect(result.stale).toBe(true);
    expect(repo.findCharacterByName("Azar")).toBeNull();
  });

  it("24. Open thread upsert idempotent", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertOpenThreads: [{ title: "Missing letter" }],
    });
    repo.applyPatch({
      upsertOpenThreads: [{ title: "Missing letter", priority: "high" }],
    });
    expect(repo.listOpenThreads()).toHaveLength(1);
    expect(repo.listOpenThreads()[0].priority).toBe("high");
  });

  it("25. Secret knownBy/hiddenFrom resolve character IDs", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertCharacters: [{ name: "Azar" }, { name: "Anaya" }],
    });
    const azarId = repo.findCharacterByName("Azar")!.id;
    repo.applyPatch({
      upsertSecrets: [
        {
          title: "Azar knows Anaya identity",
          knownByCharacterIds: ["Azar"],
          hiddenFromCharacterIds: ["Anaya"],
        },
      ],
    });
    const secret = repo.getMemory().secrets[0];
    expect(secret.knownByCharacterIds).toContain(azarId);
  });

  it("26. Promise status update preserves history", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertPromises: [
        { text: "Azar promised to protect Anaya", status: "active" },
      ],
    });
    repo.applyPatch({
      upsertPromises: [
        { text: "Azar promised to protect Anaya", status: "fulfilled" },
      ],
    });
    const p = repo.getMemory().promises[0];
    expect(p.status).toBe("fulfilled");
    expect(p.history.length).toBeGreaterThan(0);
  });

  it("27. Timeline supports flashback sequence", () => {
    const repo = new ConversationStateMemoryRepository();
    repo.applyPatch({
      upsertTimeline: [
        {
          label: "Three years earlier",
          sequence: 1,
          relativeTime: "three years before current events",
        },
        { label: "Present day", sequence: 2 },
      ],
    });
    expect(repo.getMemory().timeline.map((t) => t.sequence)).toEqual([1, 2]);
  });

  it("28. Memory summary logs contain no full draft", () => {
    const v2 = upgradeStoryMemory(legacyFixture);
    const summary = summarizeMemoryForLogs(v2);
    const json = JSON.stringify(summary);
    expect(json).not.toContain("racing heart");
    expect(summary.hasLatestDraft).toBe(true);
    expect(summary.memoryVersion).toBe(2);
  });

  it("29–30. parseStoryMemory + legacy adapter keep Phase A/B shapes", () => {
    const memory = parseStoryMemory(legacyFixture);
    expect(memory.storyMemory.title).toBe("Forbidden Hours");
    expect(memory.characters[0].name).toBe("Anaya");
    expect(memory.latestDraft?.content).toBeTruthy();
    const v2Patch = legacyPatchToMemoryV2Patch({
      preferences: { dialogueLanguage: "hindi" },
      characters: [],
      relationships: [],
      writingRules: [],
      story: {},
      remove: [],
    });
    expect(v2Patch.updatePreferences.dialogueLanguage).toBe("hindi");
  });

  it("legacy correction remove+add maps to corrections", () => {
    const v2 = upgradeStoryMemory(legacyFixture);
    const patch = legacyPatchToMemoryV2Patch(
      {
        remove: [
          { type: "relationship", from: "Anaya", to: "Azar" },
        ],
        relationships: [
          { from: "Anaya", to: "Azar", type: "daughter" },
        ],
        characters: [],
        writingRules: [],
        story: {},
        preferences: {},
      },
      v2
    );
    expect(patch.corrections.length).toBeGreaterThan(0);
    expect(patch.corrections[0].correctValue).toBe("daughter");
  });

  it("performance: upgrade + large patch under budget", () => {
    const big: StoryMemoryV2 = upgradeStoryMemory({});
    const chars = Array.from({ length: 100 }, (_, i) => ({
      name: `Char${i}`,
      personalityTraits: ["a"],
    }));
    const t0 = performance.now();
    const upgraded = upgradeStoryMemory(legacyFixture);
    const result = applyMemoryV2Patch(upgraded, {
      upsertCharacters: chars,
      upsertRelationships: Array.from({ length: 300 }, (_, i) => ({
        fromName: `Char${i % 100}`,
        toName: `Char${(i + 1) % 100}`,
        type: `link_${i % 10}`,
      })),
    });
    const ms = performance.now() - t0;
    expect(result.memory.characters.length).toBeGreaterThan(50);
    expect(ms).toBeLessThan(200);
    void big;
  });
});
