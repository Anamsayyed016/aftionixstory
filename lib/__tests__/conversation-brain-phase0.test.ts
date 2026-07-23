import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  planConversationTurn,
  shouldUseLlmIntentClassifier,
  searchMemory,
  BRAIN_TOOL_REGISTRY,
  executeBrainTools,
  BRAIN_VERSION,
} from "@/lib/conversation-brain";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";

describe("Conversation Brain Phase 0 — planner", () => {
  it("plans greeting without AI", () => {
    const plan = planConversationTurn("hey");
    expect(plan.intent).toBe("greeting");
    expect(plan.aiRequired).toBe(false);
    expect(plan.deterministicHandled).toBe(true);
    expect(plan.plannerSource).toBe("deterministic");
    expect(plan.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("plans CEO and intern as memory_update", () => {
    const plan = planConversationTurn("CEO and intern");
    expect(plan.intent).toBe("memory_update");
    expect(plan.aiRequired).toBe(false);
    expect(plan.needsCreativeGeneration).toBe(false);
    expect(plan.deterministicHandled).toBe(true);
  });

  it("plans Hinglish preference as language_change", () => {
    const plan = planConversationTurn("Hinglish me likho");
    expect(plan.intent).toBe("language_change");
    expect(plan.aiRequired).toBe(false);
  });

  it("plans brainstorm for suggest three stories", () => {
    const plan = planConversationTurn("Suggest three unique stories");
    expect(plan.intent).toBe("brainstorm");
    expect(plan.aiRequired).toBe(true);
    expect(plan.needsCreativeGeneration).toBe(false);
    expect(plan.operation).toBe("brainstorm");
  });

  it("plans continue with draft target when latestDraft exists", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Scene",
      content: "Enough draft content for continue targeting tests here.",
      wordCount: 10,
    };
    const plan = planConversationTurn("Continue", memory);
    expect(plan.intent).toBe("continue");
    expect(plan.continueTarget).toBe("draft");
  });

  it("does not request LLM classifier for deterministic plans", () => {
    const plan = planConversationTurn("Azar male lead");
    expect(shouldUseLlmIntentClassifier(plan)).toBe(false);
  });
});

describe("Conversation Brain Phase 0 — memory search", () => {
  it("returns section labels without requiring embeddings", () => {
    const memory = emptyStoryMemory();
    memory.characters = [
      {
        name: "Azar",
        role: "male lead",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
      {
        name: "Anaya",
        role: "female lead",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
    ];
    const slice = searchMemory(memory, {
      intent: "scene",
      userMessage: "Write a scene with Azar",
      mentionedNames: ["Azar"],
    });
    expect(slice.characters.map((c) => c.name)).toContain("Azar");
    expect(slice.sectionLabels).toContain("characters");
  });
});

describe("Conversation Brain Phase 0 — tools stub", () => {
  it("registers tools without executing DB writes", async () => {
    expect(BRAIN_TOOL_REGISTRY.length).toBeGreaterThan(5);
    const results = await executeBrainTools([
      { name: "remember_character", args: { name: "Azar" } },
    ]);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.code).toBe("TOOL_NOT_IMPLEMENTED");
  });
});

describe("Conversation Brain Phase 0 — wiring", () => {
  it("exports brain version 0", () => {
    expect(BRAIN_VERSION).toBe("0");
  });

  it("storyAgentTurnAction uses Conversation Brain, not direct runStoryOperation", () => {
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

    const turnSource = readFileSync(
      path.resolve("lib/story-agent/run-turn.ts"),
      "utf8"
    );
    expect(turnSource).toContain("runConversationTurn");
    expect(turnSource).toContain("@/lib/conversation-brain/server");
    expect(turnSource).not.toMatch(
      /from\s+"@\/lib\/ai\/services\/run-story-operation"/
    );
  });

  it("CreateStoryChat still uses storyAgentTurnAction only", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/create-story-chat.tsx"),
      "utf8"
    );
    expect(source).toContain("storyAgentTurnAction");
    expect(source).not.toContain("chatCreateStoryAction");
  });
});
