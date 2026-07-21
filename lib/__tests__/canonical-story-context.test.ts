import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  buildCanonicalStoryContext,
  extractCanonicalNamesFromSynopsis,
  isStoryContinuationModifier,
} from "@/lib/story-agent/canonical-story-context";
import { assessDraftRelevance } from "@/lib/story-agent/draft-relevance";
import { extractMentionedCharacters, resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import { extractMemoryFacts } from "@/lib/story-agent/memory-facts";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { generateWriteScene } from "@/lib/ai/services/write-scene";

vi.mock("@/lib/usage/generation", () => ({
  assertWithinGenerationLimit: vi.fn(async () => undefined),
  assertGenerationRateLimit: vi.fn(async () => undefined),
  incrementSuccessfulGeneration: vi.fn(async () => undefined),
}));

const synopsis = `Azar Sayyed and Sameer have been business partners and childhood friends for years. Sameer's daughter Anaya is close to Azar's family. Alya and Dr. Armaan want a nikah, but Azar refuses because of an old secret. When Anaya tries to persuade Azar, he slaps her. Anaya arranges the nikah and leaves Paris. Years later, Alya is pregnant and calls Anaya to return. The emotional arc is an age-gap romance between Azar and Anaya.`;

function canon(latestInstruction = synopsis) {
  return buildCanonicalStoryContext({
    conversationId: "conversation_azar",
    memory: emptyStoryMemory(),
    recentMessages: [{ role: "user", content: synopsis }],
    latestInstruction,
  });
}

describe("canonical story context", () => {
  it("extracts the supplied story's actual cast", () => {
    expect(extractCanonicalNamesFromSynopsis(synopsis)).toEqual(
      expect.arrayContaining(["Azar Sayyed", "Sameer", "Dr. Armaan", "Alya", "Anaya"])
    );
    expect(canon().characters.map((character) => character.name)).toEqual(
      expect.arrayContaining(["Azar Sayyed", "Sameer", "Dr. Armaan", "Alya", "Anaya"])
    );
  });

  it("never turns correction or style terms into characters", () => {
    const invalid = ["Business", "Baat", "Updated", "Got", "Hinglish", "Rewrite", "Continue"];
    const facts = extractMemoryFacts("Business — not partners; Hinglish rewrite continue.");
    expect(facts.patch.characters).toEqual([]);
    expect(
      extractMentionedCharacters("Build Business and Baat. Rewrite this Hinglish scene and continue.")
        .map((character) => character.name)
    ).not.toEqual(expect.arrayContaining(invalid));
  });

  it('keeps the original canon when the follow-up is only "hinglish"', () => {
    const original = canon();
    const followUp = buildCanonicalStoryContext({
      conversationId: original.conversationId,
      memory: emptyStoryMemory(),
      recentMessages: [
        { role: "user", content: synopsis },
        { role: "user", content: "hinglish" },
      ],
      latestInstruction: "hinglish",
      previous: original,
    });

    expect(followUp.rawSynopsis).toBe(synopsis);
    expect(followUp.language).toBe("Hinglish");
    expect(followUp.characters.map((character) => character.name)).toEqual(
      expect.arrayContaining(["Azar Sayyed", "Sameer", "Dr. Armaan", "Alya", "Anaya"])
    );
    expect(followUp.locations).toContain("Paris");
    expect(followUp.plotFacts.join(" ").toLowerCase()).toContain("nikah");
    expect(followUp.plotFacts.join(" ").toLowerCase()).toContain("refuses");
    expect(followUp.plotFacts.join(" ").toLowerCase()).toContain("leaves paris");
    expect(followUp.plotFacts.join(" ").toLowerCase()).toContain("calls anaya to return");
  });

  it("keeps a short correction as a canonical update that must continue the active story", () => {
    const context = buildCanonicalStoryContext({
      conversationId: "conversation_azar",
      memory: emptyStoryMemory(),
      recentMessages: [{ role: "user", content: synopsis }],
      latestInstruction: "Business — not partners.",
      previous: canon(),
    });
    expect(isStoryContinuationModifier("Business — not partners.")).toBe(true);
    expect(context.rawSynopsis).toBe(synopsis);
    expect(context.lockedFacts).toContain("Latest canonical update: Business — not partners.");
  });

  it("rejects an unrelated Liya/Chahe universe and accepts a grounded Azar/Anaya scene", () => {
    const context = canon("hinglish");
    const resolved = resolveSceneRequest("hinglish", emptyStoryMemory());
    const unrelated = assessDraftRelevance({
      userMessage: "hinglish",
      title: "Harbor Market",
      content: "Liya met Chahe at Harbor Market to trade a ledger token with the Scarred Man.",
      resolved,
      canonicalContext: context,
    });
    expect(unrelated.ok).toBe(false);
    expect(unrelated.violationCodes).toEqual(
      expect.arrayContaining(["MISSING_REQUIRED_CHARACTER", "UNKNOWN_LEAD_CHARACTER", "LOCATION_DRIFT"])
    );

    const grounded = assessDraftRelevance({
      userMessage: "hinglish",
      title: "Episode 1 — Sayyed House",
      content: "Episode 1\nScene 1\n\nAzar Sayyed ne Anaya ki taraf dekha. \"Yeh nikah nahi hoga,\" usne kaha. Anaya ka dil toot gaya, lekin woh Alya ke liye khadi rahi.",
      resolved,
      canonicalContext: context,
    });
    expect(grounded.ok).toBe(true);
  });

  it("keeps new-chat writes on the grounded writer and filters the Using hint", () => {
    const router = readFileSync(path.resolve("lib/story-agent/action-router.ts"), "utf8");
    const writer = readFileSync(path.resolve("lib/ai/services/write-scene.ts"), "utf8");
    const ui = readFileSync(path.resolve("components/app/chat/create-story-chat.tsx"), "utf8");
    expect(router).toContain("generateWriteScene");
    expect(router).not.toContain("generateConversationalDraft(");
    expect(writer).toContain("serializeCanonicalStoryContext(canonical)");
    expect(ui).toContain("isValidCanonicalEntityName");
  });

  it("sends the full canonical context through a no-storyId opening write", async () => {
    const context = canon("hinglish");
    let prompt = "";
    const provider = new MockAIProvider((input) => {
      prompt = input.prompt;
      return `TITLE: Episode 1 — Sayyed House\n---\nEpisode 1\nScene 1\n\nAzar Sayyed ne Anaya ko dekha. \"Yeh nikah nahi hoga,\" usne kaha. Alya chup rahi, aur Anaya ne gehri saans li. Paris se lautne ka khayal uske dil mein abhi bhi tha.`;
    });

    const result = await generateWriteScene({
      userId: "test_user",
      memory: emptyStoryMemory(),
      userMessage: "hinglish",
      mode: "scene",
      conversationId: context.conversationId,
      storyId: null,
      canonicalContext: context,
      provider,
    });

    expect(result.content).toContain("Azar Sayyed");
    expect(prompt).toContain("CANONICAL STORY CONTEXT");
    expect(prompt).toContain(synopsis);
    expect(prompt).toContain("Azar Sayyed");
    expect(prompt).toContain("Paris");
  });

  it("rejects a twice-ungrounded draft before a caller can persist it", async () => {
    const provider = new MockAIProvider(
      () =>
        "TITLE: Harbor Market\n---\nLiya met Chahe at Harbor Market to trade a ledger token with the Scarred Man. They opened the First Ledger and planned their next move."
    );
    await expect(
      generateWriteScene({
        userId: "test_user",
        memory: emptyStoryMemory(),
        userMessage: "hinglish",
        mode: "scene",
        conversationId: "conversation_azar",
        storyId: null,
        canonicalContext: canon("hinglish"),
        provider,
      })
    ).rejects.toMatchObject({ code: "CONTEXT_MISMATCH" });
  });
});
