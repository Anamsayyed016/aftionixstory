import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  extractMentionedCharacters,
  extractWordTarget,
  seedMemoryFromMessage,
} from "@/lib/ai/context/story-context-builder";
import { buildWriteScenePrompt } from "@/lib/ai/prompts/write-scene-prompt";
import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import {
  extractProseFromAccidentalJson,
  looksLikeJsonDump,
  validateCreativeProse,
} from "@/lib/ai/services/creative-text";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { generateWriteScene } from "@/lib/ai/services/write-scene";
import { wantsJsonOutput } from "@/lib/ai/providers/openai";
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { OPERATION_PROFILES } from "@/lib/story-agent/operations";

vi.mock("@/lib/usage/generation", () => ({
  assertWithinGenerationLimit: vi.fn(async () => undefined),
  assertGenerationRateLimit: vi.fn(async () => undefined),
  incrementSuccessfulGeneration: vi.fn(async () => undefined),
}));

describe("Deterministic intent pre-router", () => {
  it("routes romantic scene requests to write_scene with high confidence", () => {
    const route = routeIntent(
      "Write a short romantic scene (300–500 words) between Azar (college owner) and Anaya (student) to set the tone."
    );
    expect(route.operation).toBe("write_scene");
    expect(route.confidence).toBe("high");
    expect(route.skipClassifier).toBe(true);
  });

  it("routes horror scene without requiring characters", () => {
    const route = routeIntent(
      "Write a horror scene in an abandoned hospital."
    );
    expect(route.operation).toBe("write_scene");
  });

  it("routes do-not-start + options to brainstorm without generation", () => {
    const route = routeIntent("Story start mat karna, sirf options do.");
    expect(route.generationBlocked).toBe(true);
    expect(route.operation).toBe("brainstorm");
    expect(route.fixedReply).toBeTruthy();
  });

  it("routes memory corrections", () => {
    const route = routeIntent("Anaya childish nahi hai.");
    expect(route.operation).toBe("memory_update");
  });

  it("routes revise when draft exists", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Scene",
      content: "Once upon a time there was a long draft body for revision.",
      wordCount: 12,
    };
    const route = routeIntent(
      "Make the previous scene slower and more emotional.",
      memory
    );
    expect(route.operation).toBe("revise_draft");
    expect(route.skipClassifier).toBe(true);
  });

  it("routes next episode to continue_episode", () => {
    expect(routeIntent("Next episode.").operation).toBe("continue_episode");
  });

  it("routes fantasy start", () => {
    expect(
      routeIntent("Fantasy story start karo, heroine ka naam Zara hai.").operation
    ).toBe("start_story");
  });

  it("routes concept create requests to brainstorm, not greeting", () => {
    const route = routeIntent("Help me create a forbidden romance");
    expect(route.operation).toBe("brainstorm");
    expect(route.fixedReply).toBeUndefined();
  });
});

describe("Operation profiles", () => {
  it("uses text output for creative ops and structured for memory", () => {
    expect(OPERATION_PROFILES.write_scene.outputMode).toBe("text");
    expect(OPERATION_PROFILES.write_scene.modelProfile).toBe("creative");
    expect(OPERATION_PROFILES.memory_update.outputMode).toBe("structured");
    expect(OPERATION_PROFILES.conversational_chat.outputMode).toBe("structured");
  });
});

describe("Context + write-scene prompt", () => {
  it("extracts word targets and characters dynamically", () => {
    const msg =
      "Write a short romantic scene (300–500 words) between Azar (college owner) and Anaya (student).";
    expect(extractWordTarget(msg)).toEqual({ min: 300, max: 500 });
    const chars = extractMentionedCharacters(msg);
    expect(chars.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Azar", "Anaya"])
    );
    expect(chars.find((c) => c.name === "Azar")?.role).toMatch(/college/i);
  });

  it("builds a plain-text scene prompt without JSON requirements", () => {
    const memory = seedMemoryFromMessage(
      emptyStoryMemory(),
      "Write a romantic scene between Azar (college owner) and Anaya (student)."
    );
    const ctx = buildStoryContext({
      operation: "write_scene",
      memory,
      userMessage:
        "Write a short romantic scene (300–500 words) between Azar and Anaya.",
    });
    const { system, prompt } = buildWriteScenePrompt(ctx);
    expect(system.toLowerCase()).toContain("do not return json");
    expect(prompt).toContain("Azar");
    expect(prompt).toContain("Anaya");
    expect(prompt).toMatch(/300/);
    expect(system).not.toContain("memoryPatch");
  });

  it("supports any genre without hardcoded romance", () => {
    const ctx = buildStoryContext({
      operation: "write_scene",
      memory: emptyStoryMemory(),
      userMessage: "Write a horror scene in an abandoned hospital.",
    });
    const { prompt } = buildWriteScenePrompt(ctx);
    expect(prompt.toLowerCase()).toContain("horror");
    expect(prompt.toLowerCase()).toContain("abandoned hospital");
  });
});

describe("Creative text validation", () => {
  it("accepts plain prose without JSON parsing", () => {
    const prose = `${"The corridor smelled of rain. ".repeat(20)}\nAzar looked at Anaya.`;
    const validated = validateCreativeProse(prose);
    expect(validated.content.length).toBeGreaterThan(100);
    expect(validated.wordCount).toBeGreaterThan(20);
  });

  it("does not treat creative prose as JSON dump", () => {
    expect(looksLikeJsonDump("Once upon a time Azar met Anaya.")).toBe(false);
  });

  it("safely extracts content from accidental JSON wrapper", () => {
    const wrapped = JSON.stringify({
      content: "A".repeat(80) + " vivid scene between two people in a courtyard.",
    });
    expect(extractProseFromAccidentalJson(wrapped)?.length).toBeGreaterThan(40);
  });

  it("rejects agent envelopes without runnable prose", () => {
    const envelope = JSON.stringify({
      assistantReply: "Tell me the genre",
      memoryPatch: {},
      action: { type: "none" },
    });
    expect(() => validateCreativeProse(envelope)).toThrow(/scene/i);
  });
});

describe("Provider output mode", () => {
  it("never forces JSON when outputMode is text", () => {
    expect(
      wantsJsonOutput({
        systemInstruction: "Return JSON please",
        prompt: "write a scene in json",
        outputMode: "text",
      })
    ).toBe(false);
  });

  it("forces JSON when outputMode is json", () => {
    expect(
      wantsJsonOutput({
        systemInstruction: "Hi",
        prompt: "Hello",
        outputMode: "json",
      })
    ).toBe(true);
  });
});

describe("generateWriteScene plain text", () => {
  it("returns prose from mock provider without JSON schema", async () => {
    const body = Array.from({ length: 40 }, (_, i) => `Sentence ${i} about Azar and Anaya.`).join(
      " "
    );
    const provider = new MockAIProvider(
      () => `TITLE: Courtyard dusk\n---\n${body}`
    );
    const result = await generateWriteScene({
      userId: "user_test",
      memory: seedMemoryFromMessage(
        emptyStoryMemory(),
        "Azar (college owner) and Anaya (student)"
      ),
      userMessage:
        "Write a short romantic scene (300–500 words) between Azar and Anaya.",
      mode: "scene",
      provider,
    });
    expect(result.content).toContain("Azar");
    expect(result.wordCount).toBeGreaterThan(30);
    expect(result.draftKind).toBe("scene");
  });
});

describe("UI / action wiring", () => {
  it("CreateStoryChat still uses storyAgentTurnAction only", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/create-story-chat.tsx"),
      "utf8"
    );
    expect(source).toContain("storyAgentTurnAction");
    expect(source).not.toContain("chatCreateStoryAction");
    expect(source).toContain("creative_draft");
  });

  it("storyAgentTurnAction delegates to Conversation Brain", () => {
    // storyAgentTurnAction (app/actions/story-agent.ts) delegates its turn
    // orchestration to runStoryAgentTurn (lib/story-agent/run-turn.ts), which
    // is also reused by the streaming route (app/api/chat/stream/route.ts) —
    // that's where the Conversation Brain call now lives.
    const actionSource = readFileSync(
      path.resolve("app/actions/story-agent.ts"),
      "utf8"
    );
    expect(actionSource).toContain("runStoryAgentTurn");
    expect(actionSource).toContain("@/lib/story-agent/run-turn");
    expect(actionSource).not.toContain("runStoryAgentDecision");

    const turnSource = readFileSync(
      path.resolve("lib/story-agent/run-turn.ts"),
      "utf8"
    );
    expect(turnSource).toContain("runConversationTurn");
    expect(turnSource).toContain("@/lib/conversation-brain/server");
    expect(turnSource).not.toContain("runStoryAgentDecision");
  });
});
