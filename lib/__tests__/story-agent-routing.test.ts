import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MockAIProvider } from "@/lib/ai/providers/mock";
import {
  parseStoryAgentTurnResult,
  runStoryAgentDecision,
} from "@/lib/ai/services/story-agent";
import {
  applyControlToDecision,
  looksLikeFieldChecklist,
  naturalFallbackReply,
  resolveControlDecision,
  shouldBlockGeneration,
} from "@/lib/story-agent/intent";
import {
  applyMemoryPatch,
  emptyStoryMemory,
  hasUsableWritingContext as _unused,
} from "@/lib/story-agent/memory-patch";
import { hasUsableWritingContext } from "@/lib/ai/services/conversational-draft";
import { storyAgentTurnResultSchema } from "@/lib/story-agent/schema";
import { CREATE_SUGGESTIONS } from "@/lib/chat/constants";

void _unused;

describe("CreateStoryChat wiring", () => {
  it("calls storyAgentTurnAction and never chatCreateStoryAction", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/create-story-chat.tsx"),
      "utf8"
    );
    expect(source).toContain('from "@/app/actions/story-agent"');
    expect(source).toContain("storyAgentTurnAction");
    expect(source).not.toContain("chatCreateStoryAction");
    expect(source).not.toContain("runChatCreateStoryTurn");
  });
});

describe("Deterministic control routing", () => {
  it("blocks generation for do-not-start phrases", () => {
    for (const msg of [
      "story start mat karna",
      "abhi start nahi",
      "don't start yet",
      "only concept build karo",
    ]) {
      const control = resolveControlDecision(msg);
      expect(control.generationBlocked).toBe(true);
      expect(control.forceActionType).toBe("none");
    }
  });

  it("forces generate_episode for start phrases", () => {
    for (const msg of [
      "start the story",
      "story shuru karo",
      "episode 1 start",
      "start now",
      "choose everything yourself and start",
    ]) {
      const control = resolveControlDecision(msg);
      expect(control.forceActionType).toBe("generate_episode");
      expect(control.clearGenerationBlock).toBe(true);
    }
  });

  it("handles storytelling without checklist", () => {
    const control = resolveControlDecision("storytelling");
    expect(control.forceReply).toBeTruthy();
    expect(looksLikeFieldChecklist(control.forceReply!)).toBe(false);
    expect(control.forceReply!.toLowerCase()).not.toContain("working title");
    expect(control.forceReply!.toLowerCase()).not.toContain("genre");
  });

  it("sanitizes checklist-style model replies", () => {
    const dirty = storyAgentTurnResultSchema.parse({
      assistantReply:
        "Thanks — tell me a working title, genre, language, logline, and at least one main character, plus POV and pacing.",
      intent: "ask_question",
    });
    const cleaned = applyControlToDecision(dirty, "storytelling", false);
    expect(looksLikeFieldChecklist(cleaned.assistantReply)).toBe(false);
    expect(cleaned.assistantReply).toBe(naturalFallbackReply("storytelling"));
  });

  it("keeps do-not-start block unless allow-start phrase", () => {
    expect(
      shouldBlockGeneration({
        intent: "start_story",
        doNotStartYet: true,
        userMessage: "maybe later",
      })
    ).toBe(true);
    expect(
      shouldBlockGeneration({
        intent: "start_story",
        doNotStartYet: true,
        userMessage: "start the story",
      })
    ).toBe(false);
  });
});

describe("Writing context + memory", () => {
  it("needs usable context before opening draft", () => {
    expect(hasUsableWritingContext(emptyStoryMemory())).toBe(false);
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: "forbidden love" },
      characters: [{ name: "Anaya" }, { name: "Azar" }],
    });
    expect(hasUsableWritingContext(memory)).toBe(true);
  });

  it("remembers Anaya constraint in Hinglish flow", () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      characters: [
        {
          name: "Anaya",
          personality: ["innocent"],
          avoid: ["childish"],
        },
      ],
    });
    const anaya = memory.characters.find((c) => c.name === "Anaya");
    expect(anaya?.avoid).toContain("childish");
  });
});

describe("Story Agent decision path", () => {
  it("applies control after model output for storytelling", async () => {
    const provider = new MockAIProvider(() =>
      JSON.stringify({
        assistantReply:
          "Provide title, genre, language, POV, pacing, and at least one main character.",
        intent: "ask_question",
        action: { type: "none", payload: {} },
      })
    );
    const result = await runStoryAgentDecision({
      userMessage: "storytelling",
      memory: emptyStoryMemory(),
      recentMessages: [],
      storyId: null,
      provider,
    });
    expect(result.decision.assistantReply.toLowerCase()).not.toContain(
      "working title"
    );
    expect(result.decision.assistantReply.toLowerCase()).not.toContain(
      "at least one main character"
    );
    expect(looksLikeFieldChecklist(result.decision.assistantReply)).toBe(false);
  });

  it("forces generate_episode action for start the story", async () => {
    const provider = new MockAIProvider(() =>
      JSON.stringify({
        assistantReply: "What genre and POV should we use?",
        intent: "ask_question",
        action: { type: "none", payload: {} },
      })
    );
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: "Azar and Anaya forbidden love" },
      characters: [{ name: "Azar" }, { name: "Anaya" }],
    });
    const result = await runStoryAgentDecision({
      userMessage: "start the story",
      memory,
      recentMessages: [],
      storyId: null,
      provider,
    });
    expect(result.decision.action.type).toBe("generate_episode");
    expect(result.decision.memoryPatch.preferences?.doNotStartYet).toBe(false);
  });

  it("parses shared schema for both providers", () => {
    const parsed = parseStoryAgentTurnResult(
      JSON.stringify({
        assistantReply: "Samajh gayi — slow burn rakhenge.",
        intent: "update_story",
        memoryPatch: {
          characters: [{ name: "Anaya", avoid: ["childish"] }],
        },
      })
    );
    expect(parsed.assistantReply).toContain("slow burn");
  });
});

describe("Suggestions remain conversational", () => {
  it("keeps create suggestions non-technical", () => {
    expect(CREATE_SUGGESTIONS.some((s) => /genre|pov|pacing/i.test(s.label))).toBe(
      false
    );
  });
});
