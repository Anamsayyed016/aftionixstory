import { describe, expect, it } from "vitest";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import {
  buildSceneGenerationContract,
  retrieveStoryContext,
  type RetrievalMode,
} from "@/lib/story-agent/story-context-retriever";

function seedMemory() {
  const memory = emptyStoryMemory();
  memory.storyMemory.title = "Azar & Anaya";
  memory.storyMemory.concept =
    "Azar Sayyed and Sameer have been business partners and childhood friends for years. Sameer's daughter Anaya is close to Azar's family. Alya and Dr. Armaan want a nikah, but Azar refuses because of an old secret. When Anaya tries to persuade Azar, he slaps her. Anaya arranges the nikah and leaves Paris. Years later, Alya is pregnant and calls Anaya to return. The emotional arc is an age-gap romance between Azar and Anaya.";
  memory.storyMemory.plot =
    "A tense opening conflict over nikah, a slap, and the emotional fallout that sends Anaya away from Paris.";
  memory.storyMemory.setting = "Paris";
  memory.storyMemory.language = "English";
  memory.characters = [
    { name: "Azar Sayyed", role: "male lead", personality: ["guarded", "emotionally repressed"], goals: [], conflicts: [], notes: [], avoid: [] },
    { name: "Sameer", role: "supporting", personality: ["protective"], goals: [], conflicts: [], notes: [], avoid: [] },
    { name: "Dr. Armaan", role: "supporting", personality: ["clinical"], goals: [], conflicts: [], notes: [], avoid: [] },
    { name: "Alya", role: "supporting", personality: ["pregnant", "emotionally direct"], goals: [], conflicts: [], notes: [], avoid: [] },
    { name: "Anaya", role: "female lead", personality: ["independent", "wounded"], goals: [], conflicts: [], notes: [], avoid: [] },
  ];
  memory.relationships = [
    { from: "Azar Sayyed", to: "Anaya", type: "age-gap romance", notes: "emotional arc" },
    { from: "Azar Sayyed", to: "Sameer", type: "business partner", notes: "childhood friends" },
    { from: "Alya", to: "Dr. Armaan", type: "nikah plan", notes: "wants marriage" },
    { from: "Anaya", to: "Alya", type: "family bond", notes: "future reunion" },
  ];
  memory.latestDraft = {
    title: "Episode 1",
    content: "Anaya steps into the room and Azar is furious after the slap. The emotional ache is unresolved.",
    sourceConversationId: "conv-1",
  };
  memory.userPreferences = {
    ...memory.userPreferences,
    dialogueLanguage: "English",
    narrationLanguage: "English",
  };
  return memory;
}

describe("story context retriever", () => {
  it("retrieves original synopsis and core conflict for Start Episode 1", () => {
    const memory = seedMemory();
    const ctx = retrieveStoryContext({
      memory,
      userMessage: "Start Episode 1",
      conversationId: "conv-1",
      storyId: "story-1",
      recentMessages: [{ role: "user", content: memory.storyMemory.concept ?? "" }],
      mode: "OPENING" as RetrievalMode,
    });

    expect(ctx.rawSynopsis.toLowerCase()).toContain("azar sayyed");
    expect(ctx.rawSynopsis.toLowerCase()).toContain("nikah");
    expect(ctx.lockedFacts.some((fact) => /nikah|slap|paris/i.test(fact))).toBe(true);
    expect(ctx.requiredCharacters.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Azar Sayyed", "Anaya"])
    );
  });

  it("retrieves the previous valid scene and unresolved hook for Continue", () => {
    const memory = seedMemory();
    const ctx = retrieveStoryContext({
      memory,
      userMessage: "Continue",
      conversationId: "conv-1",
      storyId: "story-1",
      recentMessages: [{ role: "user", content: "Continue" }],
      mode: "CONTINUE" as RetrievalMode,
    });

    expect(ctx.previousSceneSummary?.toLowerCase()).toContain("unresolved");
    expect(ctx.unresolvedThreads.length).toBeGreaterThan(0);
    expect(ctx.currentEpisodeGoal?.toLowerCase()).toContain("emotional ache");
  });

  it("preserves all canonical characters for hinglish style changes", () => {
    const memory = seedMemory();
    const ctx = retrieveStoryContext({
      memory,
      userMessage: "hinglish",
      conversationId: "conv-1",
      storyId: "story-1",
      recentMessages: [{ role: "user", content: "hinglish" }],
      mode: "STYLE_CHANGE" as RetrievalMode,
    });

    expect(ctx.language).toBe("Hinglish");
    expect(ctx.requiredCharacters.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Azar Sayyed", "Sameer", "Dr. Armaan", "Alya", "Anaya"])
    );
    expect(ctx.relevantRelationships.length).toBeGreaterThan(0);
  });

  it("builds a strict scene contract that forbids unrelated lead characters", () => {
    const memory = seedMemory();
    const ctx = retrieveStoryContext({
      memory,
      userMessage: "Write a scene between Azar and Anaya",
      conversationId: "conv-1",
      storyId: "story-1",
      recentMessages: [{ role: "user", content: "Write a scene between Azar and Anaya" }],
      mode: "SCENE_GENERATION" as RetrievalMode,
    });

    const contract = buildSceneGenerationContract(ctx, "Write a scene between Azar and Anaya");
    expect(contract.requiredCharacters).toEqual(expect.arrayContaining(["Azar Sayyed", "Anaya"]));
    expect(contract.allowedNewCharacters).toBe(0);
    expect(contract.activeConflict.length).toBeGreaterThan(0);
  });
});
