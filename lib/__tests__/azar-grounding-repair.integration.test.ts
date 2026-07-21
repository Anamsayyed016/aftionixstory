import { describe, expect, it, vi, beforeEach } from "vitest";

import { MockAIProvider } from "@/lib/ai/providers/mock";
import { generateWriteScene } from "@/lib/ai/services/write-scene";
import {
  buildCanonicalStoryContext,
} from "@/lib/story-agent/canonical-story-context";
import { assessDraftRelevance } from "@/lib/story-agent/draft-relevance";
import { resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import { emptyStoryMemory, applyMemoryPatch } from "@/lib/story-agent/memory-patch";
import { sanitizeStoryMemoryCanon } from "@/lib/story-agent/sanitize-memory";
import { rebuildCanonicalMemoryFromMessages } from "@/lib/story-agent/rebuild-canonical-memory";
import { emptyCreateState } from "@/lib/chat/conversation-state";

const incrementSuccessfulGeneration = vi.fn(async () => undefined);

vi.mock("@/lib/usage/generation", () => ({
  assertWithinGenerationLimit: vi.fn(async () => undefined),
  assertGenerationRateLimit: vi.fn(async () => undefined),
  get incrementSuccessfulGeneration() {
    return incrementSuccessfulGeneration;
  },
}));

const synopsis = `Azar Sayyed and Sameer have been business partners and childhood friends for years. Sameer's daughter Anaya is close to Azar's family. Alya and Dr. Armaan want a nikah, but Azar refuses because of an old secret. When Anaya tries to persuade Azar, he slaps her. Anaya arranges the nikah and leaves Paris. Years later, Alya is pregnant and calls Anaya to return. The emotional arc is an age-gap romance between Azar and Anaya.`;

const validHinglishScene = `TITLE: Episode 1 — Nikah Conflict
---
Episode 1
Scene 1

Azar Sayyed ne Sameer ki taraf dekha. Alya aur Dr. Armaan kamre mein khade the.
"Yeh nikah nahi hoga," Azar ne kaha. Sameer chup raha, lekin Armaan ne Alya ka haath pakad liya.
"Abbu, please," Alya boli. Azar ka chehra sakht tha, lekin secret uske seene mein daba hua tha.`;

const unrelatedScene = `TITLE: Harbor Market
---
Liya met Chahe at Harbor Market to trade a ledger token with the Scarred Man. They opened the First Ledger and planned their next move across the docks.`;

describe("Azar grounding integration (write-scene orchestration)", () => {
  beforeEach(() => {
    incrementSuccessfulGeneration.mockClear();
  });

  it("accepts valid subset openings (nikah conflict / Paris / Anaya-Alya)", () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: synopsis, plot: synopsis },
      characters: [
        { name: "Azar Sayyed", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
        { name: "Sameer", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
        { name: "Dr. Armaan", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
        { name: "Alya", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
        { name: "Anaya", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
        // poisoned pseudo entity that must not hard-fail subset scenes
        { name: "Business", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
      ],
    });
    const cleaned = sanitizeStoryMemoryCanon(memory).memory;
    const canonical = buildCanonicalStoryContext({
      conversationId: "c_azar_fresh",
      memory: cleaned,
      recentMessages: [{ role: "user", content: synopsis }],
      latestInstruction: "hinglish",
    });
    const resolved = resolveSceneRequest("hinglish", cleaned);

    expect(cleaned.characters.map((c) => c.name)).not.toContain("Business");
    expect(resolved.characterNames).toEqual([]);
    expect(resolved.softContextCharacters.length).toBeGreaterThan(0);

    const nikah = assessDraftRelevance({
      userMessage: "hinglish",
      title: "Episode 1",
      content: validHinglishScene,
      resolved,
      canonicalContext: canonical,
    });
    expect(nikah.ok).toBe(true);

    const paris = assessDraftRelevance({
      userMessage: "hinglish",
      title: "Paris Call",
      content:
        'Anaya Paris ke flat mein baithi thi jab phone baja. "Alya?" usne kaha. Alya ki awaaz kaampi hui — "Anaya, main pregnant hoon. Wapas aa jao."',
      resolved,
      canonicalContext: canonical,
    });
    expect(paris.ok).toBe(true);
    expect(paris.diagnostics.canonicalLeadsPresent).toEqual(
      expect.arrayContaining(["Anaya", "Alya"])
    );
  });

  it("repairs an unrelated first draft and returns a grounded scene with one credit", async () => {
    let calls = 0;
    const provider = new MockAIProvider(() => {
      calls += 1;
      return calls === 1 ? unrelatedScene : validHinglishScene;
    });

    const rebuilt = rebuildCanonicalMemoryFromMessages({
      conversationId: "c_azar_orch",
      messages: [
        { role: "user", content: synopsis },
        { role: "user", content: "hinglish" },
      ],
      latestInstruction: "hinglish",
    });

    const result = await generateWriteScene({
      userId: "user_azar",
      memory: rebuilt.memory,
      userMessage: "hinglish",
      mode: "scene",
      conversationId: "c_azar_orch",
      storyId: null,
      recentMessages: [
        { role: "user", content: synopsis },
        { role: "user", content: "hinglish" },
      ],
      canonicalContext: rebuilt.canonical,
      provider,
    });

    expect(calls).toBe(2);
    expect(result.relevanceRetry).toBe(true);
    expect(result.content).toContain("Azar");
    expect(result.content).toMatch(/nikah/i);
    expect(result.content).not.toContain("Harbor Market");
    expect(result.content).not.toContain("Scarred Man");
    expect(incrementSuccessfulGeneration).toHaveBeenCalledTimes(1);
  });

  it("keeps previous draft and consumes no credit when both attempts fail grounding", async () => {
    const provider = new MockAIProvider(() => unrelatedScene);
    const previous = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: synopsis },
      characters: [
        { name: "Anaya", personality: [], goals: [], conflicts: [], notes: [], avoid: [] },
      ],
    });
    previous.latestDraft = {
      title: "Valid previous",
      content: "Anaya ne Azar ko dekha. Yeh nikah mushkil tha, lekin woh ruk nahi sakti thi.",
      wordCount: 20,
      clientRequestId: "prev_1",
    };

    const canonical = buildCanonicalStoryContext({
      conversationId: "c_azar_fail",
      memory: previous,
      recentMessages: [{ role: "user", content: synopsis }],
      latestInstruction: "hinglish",
    });

    await expect(
      generateWriteScene({
        userId: "user_azar",
        memory: previous,
        userMessage: "hinglish",
        mode: "scene",
        conversationId: "c_azar_fail",
        storyId: null,
        canonicalContext: canonical,
        provider,
      })
    ).rejects.toMatchObject({ code: "CONTEXT_MISMATCH" });

    expect(incrementSuccessfulGeneration).not.toHaveBeenCalled();
    expect(previous.latestDraft?.title).toBe("Valid previous");
  });

  it("new CREATE conversation state starts with empty canon surfaces", () => {
    const state = emptyCreateState();
    expect(state.characters).toEqual([]);
    expect(state.relationships).toEqual([]);
    expect(state.latestDraft).toBeNull();
    expect(state.canonicalStoryContext).toBeNull();
  });
});
