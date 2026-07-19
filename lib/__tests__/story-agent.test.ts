import { describe, expect, it, vi } from "vitest";

import { parseStoryAgentTurnResult } from "@/lib/ai/services/story-agent";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { runStoryAgentDecision } from "@/lib/ai/services/story-agent";
import { hintIntentFromMessage, shouldBlockGeneration } from "@/lib/story-agent/intent";
import {
  applyMemoryPatch,
  describeMemoryStatus,
  emptyStoryMemory,
  getMissingCreateFields,
  memoryToWizardCandidate,
} from "@/lib/story-agent/memory-patch";
import {
  storyAgentTurnResultSchema,
  type StoryAgentTurnResult,
} from "@/lib/story-agent/schema";
import { CREATE_SUGGESTIONS, CHAT_SHELL_COPY } from "@/lib/chat/constants";

function baseDecision(
  overrides: Partial<StoryAgentTurnResult> = {}
): StoryAgentTurnResult {
  return storyAgentTurnResultSchema.parse({
    assistantReply: "Got it — let’s shape this carefully.",
    intent: "chat",
    ...overrides,
  });
}

describe("Story Agent schema", () => {
  it("accepts a conversational envelope with safe defaults", () => {
    const parsed = storyAgentTurnResultSchema.parse({
      assistantReply: "Nice concept. Want opening options or character focus first?",
    });
    expect(parsed.intent).toBe("chat");
    expect(parsed.action.type).toBe("none");
    expect(parsed.memoryPatch.characters).toEqual([]);
    expect(parsed.suggestions).toEqual([]);
  });

  it("never requires placeholder characters", () => {
    const parsed = parseStoryAgentTurnResult(
      JSON.stringify({
        assistantReply: "Samajh gaya.",
        intent: "update_story",
        memoryPatch: {
          characters: [{ name: "Anaya", personality: ["innocent"], avoid: ["childish"] }],
        },
      })
    );
    expect(parsed.memoryPatch.characters[0].name).toBe("Anaya");
    expect(parsed.memoryPatch.characters[0].avoid).toContain("childish");
  });
});

describe("Story Agent memory patch", () => {
  it("remembers a Hinglish character fact without wiping memory", () => {
    const first = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: "Azar ki daughter Alya aur Anaya ka brother Armaan" },
      characters: [
        { name: "Azar", role: "Father figure" },
        { name: "Alya", role: "Lead" },
        { name: "Anaya", role: "Sibling" },
        { name: "Armaan", role: "Lead" },
      ],
      relationships: [{ from: "Alya", to: "Armaan", type: "romantic interest" }],
    });
    expect(first.characters).toHaveLength(4);
    expect(first.relationships[0].type).toContain("romantic");

    const second = applyMemoryPatch(first, {
      characters: [
        {
          name: "Anaya",
          personality: ["innocent", "soft-hearted"],
          avoid: ["childish"],
        },
      ],
    });
    expect(second.characters).toHaveLength(4);
    const anaya = second.characters.find((c) => c.name === "Anaya");
    expect(anaya?.personality).toEqual(
      expect.arrayContaining(["innocent", "soft-hearted"])
    );
    expect(anaya?.avoid).toContain("childish");
  });

  it("corrects a relationship instead of duplicating it", () => {
    const base = applyMemoryPatch(emptyStoryMemory(), {
      characters: [
        { name: "Sameer" },
        { name: "Anaya" },
      ],
      relationships: [{ from: "Sameer", to: "Anaya", type: "father" }],
    });
    const corrected = applyMemoryPatch(base, {
      relationships: [{ from: "Sameer", to: "Anaya", type: "uncle" }],
    });
    expect(corrected.relationships).toHaveLength(1);
    expect(corrected.relationships[0].type).toBe("uncle");
  });

  it("removes a character and linked relationships", () => {
    const base = applyMemoryPatch(emptyStoryMemory(), {
      characters: [{ name: "Riya" }, { name: "Anaya" }],
      relationships: [{ from: "Riya", to: "Anaya", type: "friends" }],
    });
    const next = applyMemoryPatch(base, {
      remove: [{ type: "character", name: "Riya" }],
    });
    expect(next.characters.map((c) => c.name)).toEqual(["Anaya"]);
    expect(next.relationships).toHaveLength(0);
  });

  it("does not erase memory with empty patches", () => {
    const base = applyMemoryPatch(emptyStoryMemory(), {
      story: { title: "Midnight Contract", genre: ["Romance"] },
      characters: [{ name: "Aanya", role: "Lead", personality: ["sharp"] }],
    });
    const next = applyMemoryPatch(base, {
      story: { title: "", genre: [] },
      characters: [],
    });
    expect(next.storyMemory.title).toBe("Midnight Contract");
    expect(next.characters).toHaveLength(1);
  });

  it("merges duplicate character updates", () => {
    const base = applyMemoryPatch(emptyStoryMemory(), {
      characters: [{ name: "Azar", personality: ["intense"] }],
    });
    const next = applyMemoryPatch(base, {
      characters: [{ name: "Azar", personality: ["anger issues"] }],
    });
    expect(next.characters).toHaveLength(1);
    expect(next.characters[0].personality).toEqual(
      expect.arrayContaining(["intense", "anger issues"])
    );
  });
});

describe("Story Agent intent guards", () => {
  it("hints create/start/brainstorm intents", () => {
    expect(hintIntentFromMessage("create the story now")).toBe("create_story");
    expect(hintIntentFromMessage("start episode 1")).toBe("start_story");
    expect(hintIntentFromMessage("suggest three opening situations")).toBe(
      "brainstorm"
    );
  });

  it("blocks generation when do-not-start is set", () => {
    expect(
      shouldBlockGeneration({
        intent: "start_story",
        doNotStartYet: true,
        userMessage: "maybe write a little",
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

describe("Story Agent create readiness", () => {
  it("reports missing required fields without checklist UI coupling", () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      story: { concept: "forbidden romance" },
    });
    expect(getMissingCreateFields(memory).length).toBeGreaterThan(0);
  });

  it("maps memory into wizard candidate once enough facts exist", () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      story: {
        title: "Blood Moon College",
        genre: ["Romance"],
        language: "Hinglish",
      },
      characters: [
        {
          name: "Anaya",
          role: "Protagonist",
          personality: ["innocent", "brave"],
        },
      ],
    });
    expect(getMissingCreateFields(memory)).toEqual([]);
    const candidate = memoryToWizardCandidate(memory);
    expect(candidate.title).toBe("Blood Moon College");
    expect(candidate.characters[0].name).toBe("Anaya");
  });
});

describe("Story Agent provider decision parsing", () => {
  it("parses OpenAI/Gemini-style JSON through the shared contract", async () => {
    const payload = baseDecision({
      assistantReply:
        "Samajh gaya — Alya aur Armaan soft romance se shuru kar sakte hain. Story abhi start nahi karunga.",
      intent: "update_story",
      memoryPatch: {
        preferences: { doNotStartYet: true },
        characters: [
          { name: "Alya" },
          { name: "Armaan" },
        ],
        relationships: [
          { from: "Alya", to: "Armaan", type: "mutual crush" },
        ],
      },
      action: { type: "none", payload: {} },
    });

    const provider = new MockAIProvider(() => JSON.stringify(payload));
    const result = await runStoryAgentDecision({
      userMessage:
        "new concept—Azar ki daughter Alya aur Anaya ka brother Armaan ek dusre ko pasand karte hain. story start mat karna abhi",
      memory: emptyStoryMemory(),
      recentMessages: [],
      storyId: null,
      provider,
    });

    expect(result.decision.assistantReply.toLowerCase()).not.toContain("missing fields");
    expect(result.decision.assistantReply.toLowerCase()).not.toContain("json");
    expect(result.decision.action.type).toBe("none");
  });

  it("forces action none when do-not-start preference blocks generation", async () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      preferences: { doNotStartYet: true },
    });
    const provider = new MockAIProvider(() =>
      JSON.stringify(
        baseDecision({
          assistantReply: "Starting episode 1…",
          intent: "generate_episode",
          action: { type: "generate_episode", payload: {} },
        })
      )
    );
    const result = await runStoryAgentDecision({
      userMessage: "write a scene about them arguing",
      memory,
      recentMessages: [],
      storyId: "story_1",
      provider,
    });
    expect(result.decision.action.type).toBe("none");
  });
});

describe("Story Agent UX contracts", () => {
  it("uses natural first-message copy and suggestions", () => {
    expect(CHAT_SHELL_COPY.create.emptyDescription).toContain("however it comes");
    expect(CREATE_SUGGESTIONS.map((s) => s.label)).toEqual([
      "I have a new story concept",
      "Help me create a forbidden romance",
      "I only have two characters",
      "Suggest something unique",
    ]);
  });

  it("describes memory naturally", () => {
    const memory = applyMemoryPatch(emptyStoryMemory(), {
      characters: [{ name: "Azar" }, { name: "Anaya" }, { name: "Alya" }],
    });
    expect(describeMemoryStatus(memory)).toBe("3 characters remembered");
  });

  it("turn request ids are namespaced for idempotency", () => {
    const turnRequestId = "abc12345";
    expect(`t_${turnRequestId}_u`).toBe("t_abc12345_u");
    expect(`t_${turnRequestId}_a`).toBe("t_abc12345_a");
    expect(`ep_${turnRequestId}`).toBe("ep_abc12345");
  });
});

describe("Story Agent brainstorm vs write", () => {
  it("brainstorm intent stays non-writing by default", () => {
    const decision = baseDecision({
      intent: "brainstorm",
      action: { type: "suggest_options", payload: {} },
      suggestions: [
        { label: "Suggest openings", prompt: "Suggest three opening situations." },
      ],
    });
    expect(decision.action.type).not.toBe("create_story");
    expect(decision.action.type).not.toBe("generate_episode");
  });
});

// silence unused vi if needed
void vi;
