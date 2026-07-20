/**
 * Phase E — Prompt Registry v2 tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPrompt,
  composeCreateChatPrompt,
  isPromptRegistryV2Enabled,
  listPromptDefinitions,
  promptResultToLegacyParts,
  resolvePromptId,
  summarizePromptForLogs,
  validatePromptRegistry,
  INTENT_TO_PROMPT,
  PROMPT_IDS,
} from "@/lib/prompt-registry";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import { applyMemoryV2Patch, upgradeStoryMemory } from "@/lib/story-memory/v2";
import { STORY_INTENTS } from "@/lib/conversation-brain/intents";

function baseMemory() {
  let v2 = upgradeStoryMemory({});
  v2 = applyMemoryV2Patch(v2, {
    set: {
      title: "Forbidden Hours",
      concept: "CEO and intern romance",
      genre: ["Romance"],
      tone: ["emotional"],
    },
    upsertCharacters: [
      {
        name: "Anaya",
        role: "intern",
        personalityTraits: ["ambitious"],
      },
      {
        name: "Azar",
        role: "CEO",
        personalityTraits: ["reserved"],
      },
      {
        name: "Meera",
        role: "engaged",
      },
    ],
    upsertRelationships: [
      {
        fromName: "Anaya",
        toName: "Azar",
        type: "forbidden_attraction",
      },
    ],
    upsertWritingRules: [
      {
        rule: "Use natural Hinglish dialogue.",
        category: "language",
        priority: "high",
      },
      {
        rule: "Keep the pacing slow.",
        category: "pacing",
        priority: "important",
      },
      {
        rule: "Random low-priority formatting note",
        category: "formatting",
        priority: "low",
      },
    ],
    updatePreferences: {
      emojiStyle: "light",
      narrationLanguage: "hinglish",
      dialogueLanguage: "hinglish",
      storyLanguage: "hinglish",
    },
  }).memory;
  return v2;
}

function compose(intent: string, message: string, extras?: Partial<Parameters<typeof composeCreateChatPrompt>[0]>) {
  return composeCreateChatPrompt({
    intent,
    operation: intent,
    userMessage: message,
    memory: extras?.memory || baseMemory(),
    recentMessages: extras?.recentMessages || [],
    conversationFlow: extras?.conversationFlow ?? DEFAULT_CONVERSATION_FLOW,
    collaborationMode: extras?.collaborationMode,
    needsClarification: extras?.needsClarification,
    generationBlocked: extras?.generationBlocked,
    metadata: extras?.metadata,
    promptIdOverride: extras?.promptIdOverride,
    ...extras,
  });
}

describe("Prompt Registry Phase E", () => {
  const prev = process.env.AI_PROMPT_REGISTRY_V2_ENABLED;

  beforeEach(() => {
    process.env.AI_PROMPT_REGISTRY_V2_ENABLED = "true";
  });

  afterEach(() => {
    process.env.AI_PROMPT_REGISTRY_V2_ENABLED = prev;
  });

  it("validates registry with no duplicate IDs and full intent mapping", () => {
    const result = validatePromptRegistry();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    for (const intent of STORY_INTENTS) {
      expect(INTENT_TO_PROMPT[intent], `missing mapping for ${intent}`).toBeTruthy();
    }
  });

  it("1. greeting → conversation.greeting", () => {
    expect(resolvePromptId({ intent: "greeting" })).toBe("conversation.greeting");
    const r = compose("greeting", "Hey");
    expect(r.promptId).toBe("conversation.greeting");
    expect(r.promptVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("2. forbidden romance → collaborative brainstorm, anti-wizard, no scene gen", () => {
    const r = compose("brainstorm", "I want forbidden romance", {
      collaborationMode: true,
    });
    expect(r.promptId).toBe("conversation.collaborative_brainstorm");
    const text = r.messages.map((m) => m.content).join("\n");
    expect(text.toLowerCase()).toMatch(/anti-wizard|never respond like a form|do not ask for title/);
    expect(text.toLowerCase()).not.toMatch(/write only the requested scene/);
  });

  it("3. after offer — normal conversation mapping available", () => {
    expect(resolvePromptId({ intent: "offer_selection" })).toBe(
      "conversation.normal"
    );
  });

  it("4. write scene → creative.scene with selected cast", () => {
    const r = compose("write_scene", "Write a scene with Anaya and Azar", {
      entities: {
        characterNames: ["Anaya", "Azar"],
        episodeNumber: null,
        requestedTone: null,
        requestedLanguage: null,
      },
    });
    expect(r.promptId).toBe("creative.scene");
    const text = r.messages.map((m) => m.content).join("\n");
    expect(text).toMatch(/Anaya/);
    expect(text).toMatch(/Azar/);
  });

  it("5. write episode → creative.episode", () => {
    expect(resolvePromptId({ intent: "write_episode" })).toBe("creative.episode");
  });

  it("6. continue with draft → creative.continue includes draft ending", () => {
    let memory = baseMemory();
    memory = {
      ...memory,
      latestDraft: {
        title: "Draft",
        content: "BEGINNING TEXT\n" + "x".repeat(100) + "\nENDING HOOK HERE",
        wordCount: 40,
        updatedAt: new Date().toISOString(),
      },
    };
    const r = compose("continue_story", "Continue", { memory });
    expect(r.promptId).toBe("creative.continue");
    const text = r.messages.map((m) => m.content).join("\n");
    expect(text).toMatch(/ENDING HOOK HERE|latest draft|continue/i);
  });

  it("7. make emotional → revision.emotional transformation rules", () => {
    const r = compose("make_emotional", "Make it more emotional");
    expect(r.promptId).toBe("revision.emotional");
    const text = r.messages.map((m) => m.content).join("\n").toLowerCase();
    expect(text).toMatch(/emotional depth|transformation|revision/);
    expect(text).toMatch(/do not randomly add tragedy/);
  });

  it("8. shorten → revision.shorten preserve meaning", () => {
    const r = compose("shorten", "Shorter");
    expect(r.promptId).toBe("revision.shorten");
    expect(r.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /preserve.*core|emotional meaning/
    );
  });

  it("9. who is Azar → knowledge.character_question, no creative prose", () => {
    const r = compose("character_question", "Who is Azar?");
    expect(r.promptId).toBe("knowledge.character_question");
    const text = r.messages.map((m) => m.content).join("\n").toLowerCase();
    expect(text).toMatch(/answer only from supplied context/);
    expect(text).not.toMatch(/write only the requested scene/);
  });

  it("10. episode 3 → knowledge.episode_question no hallucination", () => {
    const r = compose("episode_question", "What happened in episode 3?");
    expect(r.promptId).toBe("knowledge.episode_question");
    expect(r.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /do not invent|never fabricate|missing/
    );
  });

  it("11. hinglish reply → preference.language distinguishes response vs story", () => {
    const r = compose("language_change", "Hinglish me reply karo");
    expect(r.promptId).toBe("preference.language");
    const text = r.messages.map((m) => m.content).join("\n");
    expect(text).toMatch(/responseLanguage/);
    expect(text).toMatch(/storyLanguage/);
  });

  it("12. story English → story-language behavior in language layer", () => {
    const r = compose("language_change", "Story English me likho");
    const text = r.messages.map((m) => m.content).join("\n");
    expect(text).toMatch(/storyLanguage|Story prose language/i);
  });

  it("13. generationBlocked + write scene → blocked_generation", () => {
    const r = compose("write_scene", "write a scene", {
      generationBlocked: true,
    });
    expect(r.promptId).toBe("conversation.blocked_generation");
    expect(r.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /blocked|never start writing|do not write/
    );
  });

  it("14. clarification → one question maximum", () => {
    const r = compose("unknown", "maybe?", { needsClarification: true });
    expect(r.promptId).toBe("conversation.clarification");
    expect(r.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /exactly one|at most one|one clear/
    );
  });

  it("15. brainstorm JSON — max 4 offers instruction", () => {
    const r = compose("brainstorm", "ideas", { collaborationMode: true });
    expect(r.outputMode).toBe("json");
    expect(r.messages.map((m) => m.content).join("\n")).toMatch(/0–4|0-4|max 4/i);
  });

  it("16. intent classifier — JSON only, no user-facing answer", () => {
    const empty = compose("greeting", "hi");
    const r = buildPrompt({
      promptId: "internal.intent_classifier",
      intent: "unknown",
      operation: "intent_classifier",
      userMessage: "hi",
      context: {
        contextVersion: 2,
        operation: "intent_classifier",
        story: { genre: [], tone: [], themes: [] },
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
        preferences: empty.messages ? {} : {},
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
      metadata: { intentContextSummary: "phase: open" },
    });
    expect(r.outputMode).toBe("json");
    const text = r.messages.map((m) => m.content).join("\n").toLowerCase();
    expect(text).toMatch(/never answer the user/);
    expect(text).toMatch(/json/);
  });

  it("17. memory correction — strict patch, no DB instruction", () => {
    const r = compose("memory_correction", "Anaya is not sister, she is daughter");
    expect(r.promptId).toBe("memory.correction");
    const text = r.messages.map((m) => m.content).join("\n").toLowerCase();
    expect(text).toMatch(/patch/);
    expect(text).toMatch(/never instruct db|do not mutate a database|json/);
  });

  it("18. light emoji preference allowed in chat", () => {
    const r = compose("normal_chat", "hello");
    expect(r.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /emoji|0–2|light/
    );
  });

  it("19. no emoji preference", () => {
    const built = buildPrompt({
      promptId: "conversation.normal",
      intent: "normal_chat",
      operation: "conversational_chat",
      userMessage: "hello",
      context: {
        contextVersion: 2,
        operation: "conversational_chat",
        story: { genre: [], tone: [], themes: [] },
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
        preferences: { emojiStyle: "none" },
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
    expect(built.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /do not use emojis/
    );
  });

  it("20. creative prose disables emoji by default", () => {
    const r = compose("write_scene", "Write a scene with Anaya");
    expect(r.messages.map((m) => m.content).join("\n").toLowerCase()).toMatch(
      /do not use emojis in story prose/
    );
  });

  it("21. high-priority writing rule included", () => {
    const r = compose("write_scene", "Write a scene with Anaya and Azar", {
      entities: {
        characterNames: ["Anaya", "Azar"],
        episodeNumber: null,
        requestedTone: null,
        requestedLanguage: null,
      },
    });
    expect(r.messages.map((m) => m.content).join("\n")).toMatch(
      /natural hinglish dialogue/i
    );
  });

  it("22. preference language prompt excludes unrelated cast dump", () => {
    const r = compose("language_change", "Hinglish me reply karo");
    const text = r.messages.map((m) => m.content).join("\n");
    expect(r.promptId).toBe("preference.language");
    expect(text.toLowerCase()).not.toMatch(/meera stood/);
  });

  it("23. explicit instruction priority layer present", () => {
    const r = compose("write_scene", "Write a serious death scene without emojis");
    expect(r.messages.map((m) => m.content).join("\n")).toMatch(
      /INSTRUCTION PRIORITY|highest priority/i
    );
  });

  it("24. duplicate ID validation would fail", () => {
    const ids = listPromptDefinitions().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("25. every active intent has mapping", () => {
    for (const intent of STORY_INTENTS) {
      expect(resolvePromptId({ intent })).toBeTruthy();
    }
  });

  it("26. prompt version returned in result", () => {
    const r = compose("write_scene", "scene");
    expect(r.promptVersion).toBe("1.0.0");
  });

  it("27. log summary has metadata without full prompt text", () => {
    const r = compose("write_scene", "SECRET DRAFT CONTENT XYZ");
    const summary = summarizePromptForLogs(r);
    expect(summary.promptId).toBe("creative.scene");
    expect(JSON.stringify(summary)).not.toContain("SECRET DRAFT CONTENT XYZ");
  });

  it("28. no provider SDK imported by registry", () => {
    const root = join(process.cwd(), "lib/prompt-registry");
    const files = [
      "index.ts",
      "build.ts",
      "registry.ts",
      "resolve.ts",
      "compose.ts",
      "prompts/creative.ts",
      "prompts/conversation.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src).not.toMatch(/@google\/generative-ai|openai|@anthropic/);
    }
  });

  it("29. no raw Conversation.state in prompt result", () => {
    const r = compose("write_scene", "scene");
    const blob = JSON.stringify(r);
    expect(blob).not.toMatch(/Conversation\.state|__rawState/);
  });

  it("30. no auth/email in prompt result", () => {
    const r = compose("greeting", "hi");
    const blob = JSON.stringify(r);
    expect(blob).not.toMatch(/@gmail\.com|userEmail|password|apiKey/i);
  });

  it("31. prompt size estimate present", () => {
    const r = compose("write_scene", "Write a scene");
    expect(r.debug.estimatedPromptTokens).toBeGreaterThan(0);
  });

  it("32. large draft not duplicated across layers", () => {
    const draft = "UNIQUE_DRAFT_MARKER_" + "y".repeat(2000);
    let memory = baseMemory();
    memory = {
      ...memory,
      latestDraft: {
        title: "Big",
        content: draft,
        wordCount: 500,
        updatedAt: new Date().toISOString(),
      },
    };
    const r = compose("continue_story", "Continue", { memory });
    const text = r.messages.map((m) => m.content).join("\n");
    const count = text.split("UNIQUE_DRAFT_MARKER_").length - 1;
    expect(count).toBeLessThanOrEqual(2);
  });

  it("feature flag disabled reports false", () => {
    process.env.AI_PROMPT_REGISTRY_V2_ENABLED = "false";
    expect(isPromptRegistryV2Enabled()).toBe(false);
  });

  it("PROMPT_IDS catalog is non-empty", () => {
    expect(PROMPT_IDS.length).toBeGreaterThan(20);
  });

  it("legacy parts adapter returns system+user", () => {
    const r = compose("greeting", "hi");
    const parts = promptResultToLegacyParts(r);
    expect(parts.system.length).toBeGreaterThan(10);
    expect(parts.prompt.length).toBeGreaterThan(0);
  });
});
