import { describe, expect, it } from "vitest";

import { extractMemoryFacts } from "@/lib/story-agent/memory-facts";
import { routeIntent } from "@/lib/story-agent/intent-router";
import {
  applyMemoryPatch,
  emptyStoryMemory,
} from "@/lib/story-agent/memory-patch";
import {
  BRAINSTORM_FAILURE_USER_MESSAGE,
  MEMORY_FAILURE_USER_MESSAGE,
  PROVIDER_FAILURE_USER_MESSAGE,
} from "@/lib/story-agent/concept-reply";
import { friendlyMessageForCode } from "@/lib/story-agent/errors";

describe("Memory-fact routing (character roles)", () => {
  it("routes Azar/Anaya lead facts to memory_update without brainstorm", () => {
    const msg = "Azar male lead, Anaya female lead";
    const route = routeIntent(msg);
    expect(route.operation).toBe("memory_update");
    expect(route.reason).toBe("memory_facts");
    expect(route.skipClassifier).toBe(true);
    expect(route.fixedReply).toBeTruthy();
    expect(route.fixedReply!.toLowerCase()).not.toContain("story ideas");
    expect(route.memoryPatch?.characters.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Azar", "Anaya"])
    );
    expect(
      route.memoryPatch?.characters.find((c) => c.name === "Azar")?.role
    ).toMatch(/male lead/i);
    expect(
      route.memoryPatch?.characters.find((c) => c.name === "Anaya")?.role
    ).toMatch(/female lead/i);
  });

  it("persists both characters via applyMemoryPatch", () => {
    const facts = extractMemoryFacts("Azar male lead, Anaya female lead");
    const next = applyMemoryPatch(emptyStoryMemory(), facts.patch);
    expect(next.characters).toHaveLength(2);
    expect(next.characters.map((c) => c.name).sort()).toEqual([
      "Anaya",
      "Azar",
    ]);
  });

  it("does not hardcode Azar/Anaya in the extractor source path", () => {
    const facts = extractMemoryFacts("Ravi male lead, Priya female lead");
    expect(facts.matched).toBe(true);
    expect(facts.patch.characters.map((c) => c.name).sort()).toEqual([
      "Priya",
      "Ravi",
    ]);
    expect(facts.confirmReply).toMatch(/Ravi/);
    expect(facts.confirmReply).toMatch(/Priya/);
  });
});

describe("Canonical orchestration cases", () => {
  it("routes serialized suggest to brainstorm", () => {
    const route = routeIntent(
      "Suggest something unique for a serialized story"
    );
    expect(route.operation).toBe("brainstorm");
    expect(route.fixedReply).toBeUndefined();
  });

  it("routes Hinglish preference without draft to memory_update", () => {
    const route = routeIntent("Hinglish me likhna");
    expect(route.operation).toBe("memory_update");
    expect(route.skipClassifier).toBe(true);
    expect(route.fixedReply).toMatch(/Hinglish|hinglish|writing/i);
  });

  it("routes Hinglish with draft to revise_draft", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Scene",
      content: "A long enough draft body for language revision testing here.",
      wordCount: 12,
    };
    const route = routeIntent("Hinglish me likhna", memory);
    expect(route.operation).toBe("revise_draft");
  });

  it("routes write scene between characters", () => {
    expect(
      routeIntent("Write a scene between Azar and Anaya").operation
    ).toBe("write_scene");
  });

  it("routes hey to greeting", () => {
    const route = routeIntent("hey");
    expect(route.operation).toBe("conversational_chat");
    expect(route.reason).toBe("greeting_or_help");
    expect(route.fixedReply).toBeTruthy();
  });

  it("blocks generation on do-not-start", () => {
    const route = routeIntent("Story start mat karna");
    expect(route.generationBlocked).toBe(true);
    expect(route.fixedReply).toBeTruthy();
  });

  it("routes start story now", () => {
    expect(routeIntent("Start story now").operation).toBe("start_story");
  });

  it("corrects relationship father → uncle", () => {
    const memory = emptyStoryMemory();
    memory.characters = [
      {
        name: "Sameer",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
      {
        name: "Anaya",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
    ];
    memory.relationships = [
      { from: "Sameer", to: "Anaya", type: "father" },
    ];
    const route = routeIntent("Sameer father nahi uncle hai", memory);
    expect(route.operation).toBe("memory_update");
    expect(route.skipClassifier).toBe(true);
    const next = applyMemoryPatch(memory, route.memoryPatch!);
    expect(next.relationships).toEqual([
      expect.objectContaining({
        from: "Sameer",
        to: "Anaya",
        type: "uncle",
      }),
    ]);
  });
});

describe("Operation-specific failure copy", () => {
  it("never uses brainstorm copy for chat/memory failures", () => {
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story ideas"
    );
    expect(MEMORY_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story ideas"
    );
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).toContain(
      "story ideas"
    );
    expect(
      friendlyMessageForCode("AGENT_RESPONSE_INVALID", "memory_update")
    ).not.toMatch(/story ideas/i);
    expect(
      friendlyMessageForCode("AGENT_RESPONSE_INVALID", "conversational_chat")
    ).not.toMatch(/story ideas/i);
    expect(
      friendlyMessageForCode("AGENT_RESPONSE_INVALID", "brainstorm")
    ).toMatch(/story ideas/i);
  });
});
