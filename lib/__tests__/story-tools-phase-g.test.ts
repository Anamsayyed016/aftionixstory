/**
 * Phase G — Story Tool Framework tests + Phase F compatibility cleanup.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { applyMemoryV2Patch, upgradeStoryMemory } from "@/lib/story-memory/v2";
import { ConversationStateMemoryRepository } from "@/lib/story-memory/v2/repository";
import {
  __resetDefaultStoryToolRegistryForTests,
  createBuiltinTools,
  createStoryToolRegistry,
  executeToolRequests,
  getDefaultStoryToolRegistry,
  intentRequiresTools,
  isStoryToolFrameworkEnabled,
  parseToolRequestsFromText,
  planStoryTools,
  runToolFrameworkTurn,
  safeParseToolRequestsFromText,
} from "@/lib/tools";
import { buildPrompt } from "@/lib/prompt-registry/build";
import { getPromptDefinition } from "@/lib/prompt-registry/registry";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import type { TurnPlan } from "@/lib/conversation-brain/types";

function seedRepo() {
  let memory = upgradeStoryMemory({});
  memory = applyMemoryV2Patch(memory, {
    upsertCharacters: [
      { name: "Azar", role: "male_lead", personalityTraits: ["calm"] },
      { name: "Anaya", role: "female_lead" },
    ],
  }).memory;
  return new ConversationStateMemoryRepository(memory);
}

function basePlan(partial?: Partial<TurnPlan>): TurnPlan {
  return {
    intent: "memory_update",
    storyIntent: "update_character",
    operation: "memory_update",
    confidence: 0.9,
    needsMemory: true,
    needsCreativeGeneration: false,
    needsClarification: false,
    question: null,
    deterministicHandled: false,
    aiRequired: false,
    matchedSignals: [],
    plannerSource: "deterministic",
    ...partial,
  };
}

describe("Story Tools Phase G", () => {
  const prevFlag = process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED;

  beforeEach(() => {
    process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED = "true";
    __resetDefaultStoryToolRegistryForTests();
  });

  afterEach(() => {
    process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED = prevFlag;
    __resetDefaultStoryToolRegistryForTests();
  });

  it("feature flag defaults off when unset", () => {
    delete process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED;
    expect(isStoryToolFrameworkEnabled()).toBe(false);
    process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED = "true";
    expect(isStoryToolFrameworkEnabled()).toBe(true);
  });

  it("registry lists builtin tools", () => {
    const tools = createBuiltinTools();
    expect(tools.length).toBeGreaterThan(20);
    const registry = getDefaultStoryToolRegistry();
    expect(registry.lookup("character.rename")).toBeTruthy();
    expect(registry.list().length).toBe(tools.length);
  });

  it("character rename updates memory via repository", async () => {
    const repo = seedRepo();
    const batch = await executeToolRequests(
      [
        {
          toolId: "character.rename",
          arguments: { oldName: "Azar", newName: "Aariz" },
          reason: "User explicitly requested rename",
          confidence: 0.99,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(true);
    expect(repo.findCharacterByName("Aariz")?.name).toBe("Aariz");
    expect(repo.findCharacterByName("Azar")?.name).toBe("Aariz");
    expect(repo.findCharacterByName("Aariz")?.aliases).toContain("Azar");
  });

  it("character update patches traits", async () => {
    const repo = seedRepo();
    const batch = await executeToolRequests(
      [
        {
          toolId: "character.update",
          arguments: {
            name: "Anaya",
            personalityTraits: ["brave"],
          },
          reason: "update",
          confidence: 0.9,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(true);
    expect(repo.findCharacterByName("Anaya")?.personalityTraits).toContain(
      "brave"
    );
  });

  it("relationship create links characters", async () => {
    const repo = seedRepo();
    const batch = await executeToolRequests(
      [
        {
          toolId: "relationship.create",
          arguments: {
            fromName: "Azar",
            toName: "Anaya",
            type: "lovers",
          },
          reason: "user",
          confidence: 0.9,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(true);
    expect(repo.getMemory().relationships.length).toBeGreaterThan(0);
    expect(
      repo.findRelationship({ fromName: "Azar", toName: "Anaya", type: "lovers" })
    ).toBeTruthy();
  });

  it("timeline update works after add", async () => {
    const repo = seedRepo();
    const add = await executeToolRequests(
      [
        {
          toolId: "timeline.add_event",
          arguments: { label: "First meeting", notes: "cafe" },
          reason: "user",
          confidence: 0.9,
        },
      ],
      { repository: repo }
    );
    expect(add.success).toBe(true);
    const id = repo.getMemory().timeline[0]?.id;
    expect(id).toBeTruthy();
    const upd = await executeToolRequests(
      [
        {
          toolId: "timeline.update",
          arguments: { timelineId: id, label: "First meeting at cafe" },
          reason: "user",
          confidence: 0.9,
        },
      ],
      { repository: repo }
    );
    expect(upd.success).toBe(true);
    expect(repo.getMemory().timeline[0]?.label).toBe("First meeting at cafe");
  });

  it("search tools return entities without mutating", async () => {
    const repo = seedRepo();
    const before = repo.getMemory().characters.length;
    const batch = await executeToolRequests(
      [
        {
          toolId: "search.character",
          arguments: { query: "Azar" },
          reason: "q",
          confidence: 0.8,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(true);
    expect(batch.results[0]?.data).toBeTruthy();
    expect(repo.getMemory().characters.length).toBe(before);
  });

  it("validation tools detect duplicates", async () => {
    const repo = seedRepo();
    // Force duplicate alias collision by renaming with overlapping alias carefully:
    // create second character with alias Azar is hard; instead validate clean state then
    // use merge scenario: two characters with same normalized alias via patch
    repo.applyPatch({
      upsertCharacters: [{ name: "Az", aliases: ["Azar"] }],
    });
    const batch = await executeToolRequests(
      [
        {
          toolId: "validation.duplicate_characters",
          arguments: {},
          reason: "check",
          confidence: 0.7,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(true);
    expect(batch.warnings.length + ((batch.results[0]?.data as { duplicates: unknown[] })?.duplicates?.length || 0)).toBeGreaterThan(0);
  });

  it("validation.relationship fails on broken endpoints", async () => {
    const repo = seedRepo();
    repo.applyPatch({
      upsertRelationships: [
        {
          fromCharacterId: "missing_from",
          toCharacterId: "missing_to",
          type: "rivals",
        },
      ],
    });
    const batch = await executeToolRequests(
      [
        {
          toolId: "validation.relationship",
          arguments: {},
          reason: "check",
          confidence: 0.8,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(false);
    expect(batch.executionMetadata.rolledBack).toBe(true);
  });

  it("rollback restores memory when a later tool fails", async () => {
    const repo = seedRepo();
    const beforeName = repo.findCharacterByName("Azar")?.name;
    const batch = await executeToolRequests(
      [
        {
          toolId: "character.rename",
          arguments: { oldName: "Azar", newName: "Aariz" },
          reason: "ok",
          confidence: 0.99,
        },
        {
          toolId: "character.update",
          arguments: { name: "DoesNotExist", personalityTraits: ["x"] },
          reason: "fail",
          confidence: 0.5,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(false);
    expect(batch.executionMetadata.rolledBack).toBe(true);
    expect(repo.findCharacterByName("Azar")?.name).toBe(beforeName);
    expect(repo.findCharacterByName("Aariz")).toBeNull();
  });

  it("rejects invalid tool input", async () => {
    const registry = createStoryToolRegistry(createBuiltinTools());
    const invalid = registry.validate({
      toolId: "character.rename",
      arguments: { newName: "" },
    });
    expect(invalid.ok).toBe(false);
  });

  it("duplicate character create fails", async () => {
    const repo = seedRepo();
    const batch = await executeToolRequests(
      [
        {
          toolId: "character.create",
          arguments: { name: "Azar" },
          reason: "dup",
          confidence: 0.9,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(false);
    expect(batch.errors.join(" ")).toMatch(/already exists/i);
  });

  it("multiple sequential tools succeed", async () => {
    const repo = seedRepo();
    const batch = await executeToolRequests(
      [
        {
          toolId: "character.rename",
          arguments: { oldName: "Azar", newName: "Aariz" },
          reason: "rename",
          confidence: 0.99,
        },
        {
          toolId: "relationship.create",
          arguments: {
            fromName: "Aariz",
            toName: "Anaya",
            type: "friends",
          },
          reason: "rel",
          confidence: 0.9,
        },
        {
          toolId: "preferences.language",
          arguments: { language: "english" },
          reason: "pref",
          confidence: 0.9,
        },
      ],
      { repository: repo }
    );
    expect(batch.success).toBe(true);
    expect(batch.executionMetadata.toolCount).toBe(3);
    expect(repo.findCharacterByName("Aariz")).toBeTruthy();
    expect(repo.getMemory().userPreferences.language).toBe("english");
  });

  it("planner: rename yes, write_scene no", () => {
    const memory = emptyStoryMemory();
    const rename = planStoryTools({
      intent: "update_character",
      userMessage: "Rename Azar to Aariz",
      memory,
    });
    expect(rename.requiresTools).toBe(true);
    expect(rename.requests[0]?.toolId).toBe("character.rename");

    const scene = planStoryTools({
      intent: "write_scene",
      userMessage: "Write a romantic scene",
      memory,
    });
    expect(scene.requiresTools).toBe(false);
    expect(intentRequiresTools("write_scene")).toBe(false);
    expect(intentRequiresTools("continue_story")).toBe(false);
  });

  it("parses ToolRequest JSON from planner text", () => {
    const parsed = parseToolRequestsFromText(`{
      "toolRequests": [
        {
          "toolId": "character.rename",
          "arguments": { "oldName": "Azar", "newName": "Aariz" },
          "reason": "User explicitly requested rename",
          "confidence": 0.99
        }
      ],
      "assistantReply": "Renamed."
    }`);
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.assistantReply).toBe("Renamed.");
    expect(safeParseToolRequestsFromText("not json").ok).toBe(false);
  });

  it("prompt registry tool.plan emits ToolRequest instructions", () => {
    const def = getPromptDefinition("tool.plan");
    expect(def?.enabled).toBe(true);
    const result = buildPrompt({
      promptId: "tool.plan",
      intent: "update_character",
      operation: "memory_update",
      userMessage: "Rename Azar to Aariz",
      context: {
        contextVersion: 2,
        operation: "memory_update",
        story: {
          title: null,
          concept: null,
          genre: [],
          tone: [],
          themes: [],
          setting: null,
        },
        characters: [],
        relationships: [],
        locations: [],
        objects: [],
        events: [],
        timeline: [],
        openThreads: [],
        secrets: [],
        promises: [],
        worldRules: [],
        writingRules: [],
        preferences: {},
        continuity: {},
        recentConversation: [],
        latestDraft: null,
        recentSummary: null,
        knowledge: { authorKnowledge: [], characterKnowledge: {} },
        retrieval: {
          includedEntityIds: [],
          excludedCounts: {},
          reasons: [],
          estimatedTokens: 0,
          sectionTokens: {},
          truncated: false,
          truncatedDraft: false,
        },
      },
    });
    const text = result.messages.map((m) => m.content).join("\n");
    expect(text).toMatch(/toolRequests|ToolRequest/i);
    expect(text).toMatch(/Never emit memoryPatch/i);
    expect(text).not.toMatch(/Capture explicit .* into memoryPatch/i);
  });

  it("character.update prompt uses ToolRequest when flag on", () => {
    const result = buildPrompt({
      promptId: "character.update",
      intent: "update_character",
      operation: "memory_update",
      userMessage: "Make Anaya braver",
      context: {
        contextVersion: 2,
        operation: "memory_update",
        story: {
          title: null,
          concept: null,
          genre: [],
          tone: [],
          themes: [],
          setting: null,
        },
        characters: [],
        relationships: [],
        locations: [],
        objects: [],
        events: [],
        timeline: [],
        openThreads: [],
        secrets: [],
        promises: [],
        worldRules: [],
        writingRules: [],
        preferences: {},
        continuity: {},
        recentConversation: [],
        latestDraft: null,
        recentSummary: null,
        knowledge: { authorKnowledge: [], characterKnowledge: {} },
        retrieval: {
          includedEntityIds: [],
          excludedCounts: {},
          reasons: [],
          estimatedTokens: 0,
          sectionTokens: {},
          truncated: false,
          truncatedDraft: false,
        },
      },
    });
    expect(result.messages.map((m) => m.content).join("\n")).toMatch(
      /TOOL FRAMEWORK|toolRequests/
    );
  });

  it("Conversation Brain integration renames via tools", async () => {
    const repo = seedRepo();
    const legacy = emptyStoryMemory();
    const seeded = Object.assign(legacy, {
      memoryVersion: 2,
      __memoryV2: repo.getMemory(),
      characters: repo.getMemory().characters.map((c) => ({
        name: c.name,
        role: c.role,
        personalityTraits: c.personalityTraits,
      })),
    });

    const turn = await runToolFrameworkTurn({
      request: {
        userId: "u1",
        conversationId: "c1",
        storyId: null,
        memory: seeded as never,
        userMessage: "Rename Azar to Aariz",
        recentMessages: [],
        turnRequestId: "t1",
      },
      plan: basePlan({ storyIntent: "update_character" }),
      flow: { ...DEFAULT_CONVERSATION_FLOW, lastOffers: [] },
      started: Date.now(),
    });
    expect(turn).toBeTruthy();
    expect(turn!.operation).toBe("memory_update");
    expect(turn!.memory.characters.some((c) => c.name === "Aariz")).toBe(true);
  });

  it("legacy path preserved when flag off", async () => {
    process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED = "false";
    const turn = await runToolFrameworkTurn({
      request: {
        userId: "u1",
        conversationId: "c1",
        storyId: null,
        memory: emptyStoryMemory(),
        userMessage: "Rename Azar to Aariz",
        recentMessages: [],
        turnRequestId: "t1",
      },
      plan: basePlan(),
      flow: { ...DEFAULT_CONVERSATION_FLOW, lastOffers: [] },
      started: Date.now(),
    });
    expect(turn).toBeNull();
  });

  it("Phase F cleanup: summaries/chat-create/story-agent use generateTextCompat", () => {
    const files = [
      "lib/ai/services/generate-summary.ts",
      "lib/ai/services/chat-create-story.ts",
      "lib/ai/services/story-agent.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).toContain("generateTextCompat");
      expect(src).not.toMatch(/getAIProvider\(\)\s*\n?\s*\.generateText/);
    }
  });

  it("tools never import provider SDKs", () => {
    const root = join(process.cwd(), "lib/tools");
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (p.endsWith(".ts")) out.push(p);
      }
      return out;
    };
    for (const file of walk(root)) {
      if (file.endsWith("brain-adapter.ts") || file.endsWith("legacy-generate.ts")) {
        continue;
      }
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/openai|@google\/generative-ai|getAIProvider/);
    }
  });

  it("Provider Router compatibility helper exists", async () => {
    const mod = await import("@/lib/provider-router/v2/legacy-generate");
    expect(typeof mod.generateTextCompat).toBe("function");
  });
});
