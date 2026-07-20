/**
 * Phase G.5 — Instruction Fidelity regression tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emptyStoryMemory, getMemoryV2 } from "@/lib/story-agent/memory-patch";
import { buildDynamicContext } from "@/lib/context-builder/v2/builder";
import { pruneToBudget } from "@/lib/context-builder/v2/token-budget";
import { resolvePromptId } from "@/lib/prompt-registry/resolve";
import { getPromptDefinition } from "@/lib/prompt-registry/registry";
import { buildPrompt } from "@/lib/prompt-registry/build";
import {
  applyInstructionFidelityPreTurn,
  buildStoryGenerationContract,
  evaluateStoryReadiness,
  extractExplicitFactsFromMessage,
  isInstructionFidelityEnabled,
  readFidelityState,
  resolveStoryFacts,
  serializeGenerationContract,
  shouldAskQuestion,
  shouldSuppressClarification,
  validateStoryOutput,
  writeFidelityState,
  SAFE_GENERATION_FAILURE_MESSAGE,
} from "@/lib/story-fidelity";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import type { TurnPlan } from "@/lib/conversation-brain/types";
import { StoryAgentError } from "@/lib/story-agent/errors";

function plan(partial?: Partial<TurnPlan>): TurnPlan {
  return {
    intent: "normal_chat",
    storyIntent: "normal_chat",
    operation: "conversational_chat",
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

const VALID_HINGLISH_EPISODE = `EPISODE 1

SCENE 1 — College courtyard
AZAR [nervous]
"Anaya, wait… yeh assignment late ho gaya hai kya?"

ANAYA [smiling]
"Arre calm raho. Main help karti hoon — library ke paas milte hain."

SCENE 2 — College library
AZAR [soft]
"Tumhara vibe alag hai… serious but kind."

ANAYA [curious]
"Aur tumhara? Quiet, but dil se baat karte ho."
`;

const GENERIC_BAD_DRAFT = `TITLE: Rainy Café
Maya walked into the café as rain poured outside.
Arun smiled and ordered coffee in perfect English only.
They talked about destiny with no campus in sight.
`;

describe("Instruction Fidelity Phase G.5", () => {
  const prev = process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED;

  beforeEach(() => {
    process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED = "true";
  });

  afterEach(() => {
    process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED = prev;
  });

  it("feature flag defaults off", () => {
    delete process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED;
    expect(isInstructionFidelityEnabled()).toBe(false);
  });

  it("exact regression: resolve + lock facts across turns", () => {
    let memory = emptyStoryMemory();
    const turns = [
      "I have a new story concept",
      "hinglish",
      "azar main lead male and anaya female main lead",
      "college",
      "abhi story start nahi karna",
      "character uppercase me aayge, uske just niche dialogues",
      "emotion in brackets",
      "episode scene me divided",
    ];

    for (const msg of turns) {
      const { state } = resolveStoryFacts({
        userMessage: msg,
        memory,
        turnRequestId: `t_${msg.slice(0, 8)}`,
      });
      memory = writeFidelityState(memory, state);
    }

    const facts = readFidelityState(memory).resolvedFacts;
    expect(facts.language.storyLanguage).toBe("hinglish");
    expect(facts.characters.mainMaleLead).toBe("Azar");
    expect(facts.characters.mainFemaleLead).toBe("Anaya");
    expect(facts.setting.primarySetting).toBe("college");
    expect(facts.conversationRules.doNotStartStoryYet).toBe(true);
    expect(facts.storyStatus).toBe("planning");
    expect(facts.formatRules.uppercaseCharacterNames).toBe(true);
    expect(facts.formatRules.emotionInBrackets).toBe(true);
    expect(facts.formatRules.dialogueOnNextLine).toBe(true);
    expect(facts.formatRules.sceneDivisions).toBe(true);
    expect(facts.metadata.lockedFields).toEqual(
      expect.arrayContaining([
        "language.storyLanguage",
        "characters.mainMaleLead",
        "characters.mainFemaleLead",
        "setting.primarySetting",
      ])
    );

    // start unlocks
    const started = resolveStoryFacts({
      userMessage: "start the story",
      memory,
    });
    memory = writeFidelityState(memory, started.state);
    const after = readFidelityState(memory).resolvedFacts;
    expect(after.conversationRules.doNotStartStoryYet).toBe(false);
    expect(after.storyStatus).toBe("writing");
  });

  it("latest rename correction overrides locked lead", () => {
    let memory = emptyStoryMemory();
    let r = resolveStoryFacts({
      userMessage: "azar main lead male and anaya female main lead",
      memory,
    });
    memory = writeFidelityState(memory, r.state);
    r = resolveStoryFacts({
      userMessage: "Rename Azar to Aariz",
      memory,
      explicitCorrection: true,
    });
    memory = writeFidelityState(memory, r.state);
    const facts = readFidelityState(memory).resolvedFacts;
    expect(facts.characters.mainMaleLead).toBe("Aariz");
    expect(facts.characters.aliases.Aariz || []).toContain("Azar");
  });

  it("repeated question prevention for college/language/leads", () => {
    let memory = emptyStoryMemory();
    const r = resolveStoryFacts({
      userMessage: "azar main lead male and anaya female main lead",
      memory,
    });
    memory = writeFidelityState(memory, r.state);
    const r2 = resolveStoryFacts({
      userMessage: "college",
      memory,
    });
    memory = writeFidelityState(memory, r2.state);
    const r3 = resolveStoryFacts({
      userMessage: "hinglish",
      memory,
    });
    memory = writeFidelityState(memory, r3.state);
    const facts = readFidelityState(memory).resolvedFacts;
    const answered = readFidelityState(memory).answeredQuestions;

    expect(shouldAskQuestion("primary_setting", facts, answered).allowed).toBe(
      false
    );
    expect(shouldAskQuestion("story_language", facts, answered).allowed).toBe(
      false
    );
    expect(shouldAskQuestion("leads", facts, answered).allowed).toBe(false);

    const suppress = shouldSuppressClarification({
      question: "College ya unexpected place?",
      facts,
      answered,
    });
    expect(suppress.suppress).toBe(true);
  });

  it("planning-only blocks generation; start unlocks", () => {
    let memory = emptyStoryMemory();
    for (const msg of [
      "azar main lead male and anaya female main lead",
      "college",
      "hinglish",
      "abhi story start nahi karna",
    ]) {
      const r = resolveStoryFacts({ userMessage: msg, memory });
      memory = writeFidelityState(memory, r.state);
    }
    const facts = readFidelityState(memory).resolvedFacts;
    const blocked = evaluateStoryReadiness({
      facts,
      userMessage: "write a scene",
      intent: "write_scene",
    });
    expect(blocked.generationAllowed).toBe(false);
    expect(blocked.mode).toBe("planning_only");

    const unlockedFacts = resolveStoryFacts({
      userMessage: "start the story",
      memory,
    }).facts;
    const ready = evaluateStoryReadiness({
      facts: unlockedFacts,
      userMessage: "start the story",
      intent: "write_episode",
    });
    expect(ready.generationAllowed).toBe(true);
    expect(ready.mode).toBe("explicit_start");
  });

  it("brain adapter suppresses clarification and blocks creative while planning", () => {
    let memory = emptyStoryMemory();
    for (const msg of ["hinglish", "college", "abhi story start nahi karna"]) {
      const r = resolveStoryFacts({ userMessage: msg, memory });
      memory = writeFidelityState(memory, r.state);
    }
    const result = applyInstructionFidelityPreTurn({
      memory,
      userMessage: "write opening scene",
      plan: plan({
        intent: "scene",
        storyIntent: "write_scene",
        operation: "write_scene",
        needsCreativeGeneration: true,
        needsClarification: true,
        question: "College ya unexpected place?",
      }),
      flow: { ...DEFAULT_CONVERSATION_FLOW, lastOffers: [] },
    });
    expect(result.plan.needsClarification).toBe(false);
    expect(result.blockCreativeGeneration).toBe(true);
    expect(result.planningReply).toMatch(/start nahi|start the story/i);
  });

  it("generation contract serializes explicit constraints", () => {
    const { facts } = resolveStoryFacts({
      userMessage: "azar main lead male and anaya female main lead",
      memory: emptyStoryMemory(),
    });
    const withMore = resolveStoryFacts({
      userMessage: "college",
      memory: writeFidelityState(emptyStoryMemory(), {
        resolvedFacts: facts,
        answeredQuestions: [],
        lastContractMeta: null,
        lastValidationSummary: null,
      }),
    }).facts;
    const withLang = resolveStoryFacts({
      userMessage: "hinglish",
      memory: writeFidelityState(emptyStoryMemory(), {
        resolvedFacts: withMore,
        answeredQuestions: [],
        lastContractMeta: null,
        lastValidationSummary: null,
      }),
    }).facts;
    const contract = buildStoryGenerationContract({
      facts: withLang,
      operation: "write_episode",
      latestInstruction: "start the story",
    });
    const text = serializeGenerationContract(contract);
    expect(text).toMatch(/REQUIRED/);
    expect(text).toMatch(/AZAR|Azar|azar/);
    expect(text).toMatch(/ANAYA|Anaya|anaya/);
    expect(text).toMatch(/COLLEGE|college/i);
    expect(text).toMatch(/HINGLISH|hinglish/i);
    expect(text).toMatch(/FORBIDDEN/);
  });

  it("validates locked leads, setting, hinglish, format", () => {
    let memory = emptyStoryMemory();
    for (const msg of [
      "azar main lead male and anaya female main lead",
      "college",
      "hinglish",
      "character uppercase me aayge, uske just niche dialogues",
      "emotion in brackets",
      "episode scene me divided",
      "start the story",
    ]) {
      const r = resolveStoryFacts({ userMessage: msg, memory });
      memory = writeFidelityState(memory, r.state);
    }
    const facts = readFidelityState(memory).resolvedFacts;
    const contract = buildStoryGenerationContract({
      facts,
      operation: "write_episode",
      latestInstruction: "start the story",
    });

    const ok = validateStoryOutput({
      title: "Episode 1",
      content: VALID_HINGLISH_EPISODE,
      contract,
    });
    expect(ok.valid).toBe(true);
    expect(ok.score).toBeGreaterThan(0.55);

    const bad = validateStoryOutput({
      title: "Rainy Café",
      content: GENERIC_BAD_DRAFT,
      contract,
    });
    expect(bad.valid).toBe(false);
    const codes = bad.violations.map((v) => v.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/CHARACTER|SETTING|LANGUAGE|GENERIC|FORMAT/),
      ])
    );
    expect(bad.repairable).toBe(true);
  });

  it("rejects Maya/Arun unrelated leads and café substitution", () => {
    const { facts } = resolveStoryFacts({
      userMessage: "azar main lead male and anaya female main lead",
      memory: emptyStoryMemory(),
    });
    const memory = writeFidelityState(emptyStoryMemory(), {
      resolvedFacts: {
        ...facts,
        language: { ...facts.language, storyLanguage: "hinglish" },
        setting: { primarySetting: "college", secondarySettings: [] },
        formatRules: {
          ...facts.formatRules,
          uppercaseCharacterNames: true,
        },
        storyStatus: "writing",
        conversationRules: {
          ...facts.conversationRules,
          doNotStartStoryYet: false,
        },
      },
      answeredQuestions: [],
      lastContractMeta: null,
      lastValidationSummary: null,
    });
    const contract = buildStoryGenerationContract({
      facts: readFidelityState(memory).resolvedFacts,
      operation: "write_scene",
      latestInstruction: "start the story",
    });
    const bad = validateStoryOutput({
      content: GENERIC_BAD_DRAFT,
      contract,
    });
    expect(bad.violations.some((v) => v.code === "CHARACTER_SUBSTITUTION" || v.code === "CHARACTER_MISSING")).toBe(true);
    expect(
      bad.violations.some(
        (v) =>
          v.code === "SETTING_MISSING" || v.code === "SETTING_SUBSTITUTION"
      )
    ).toBe(true);
  });

  it("safe failure message constant is user-safe", () => {
    expect(SAFE_GENERATION_FAILURE_MESSAGE).not.toMatch(/openai|gemini|provider|stack/i);
    const err = new StoryAgentError(
      "INSTRUCTION_FIDELITY_FAILED",
      SAFE_GENERATION_FAILURE_MESSAGE,
      { retryable: true, operation: "write_scene" }
    );
    expect(err.message).toBe(SAFE_GENERATION_FAILURE_MESSAGE);
  });

  it("prompt registry integrates strict + repair ids", () => {
    expect(getPromptDefinition("story.generation.strict")?.enabled).toBe(true);
    expect(getPromptDefinition("story.repair.fidelity")?.enabled).toBe(true);
    expect(resolvePromptId({ intent: "write_scene" })).toBe(
      "story.generation.strict"
    );
  });

  it("dynamic context pruning preserves instructionContract", () => {
    let memory = emptyStoryMemory();
    const r = resolveStoryFacts({
      userMessage: "azar main lead male and anaya female main lead",
      memory,
    });
    memory = writeFidelityState(memory, r.state);
    const r2 = resolveStoryFacts({ userMessage: "college", memory });
    memory = writeFidelityState(memory, r2.state);

    const ctx = buildDynamicContext({
      intent: "write_scene",
      operation: "write_scene",
      userMessage: "start the story",
      memory: getMemoryV2(memory),
      recentMessages: [],
      entities: {
        characterNames: ["Azar", "Anaya"],
        episodeNumber: null,
        requestedTone: null,
        requestedLanguage: null,
      },
    });
    expect(ctx.instructionContract).toBeTruthy();
    expect(ctx.instructionContract).toMatch(/CONTRACT|REQUIRED/i);

    const pruned = pruneToBudget(
      {
        ...ctx,
        events: Array.from({ length: 40 }, (_, i) => ({
          id: `e${i}`,
          title: `Event ${i} `.repeat(20),
          description: "x".repeat(200),
          type: null,
          episodeNumber: null,
          characterIds: [],
          locationId: null,
          importance: "minor",
          order: i,
        })),
        objects: Array.from({ length: 20 }, (_, i) => ({
          id: `o${i}`,
          name: `Obj ${i}`,
          type: null,
          description: "y".repeat(100),
        })),
      },
      500,
      new Set()
    );
    expect(pruned.instructionContract).toBe(ctx.instructionContract);
  });

  it("memory persists fidelity state without raw prompts", () => {
    let memory = emptyStoryMemory();
    const r = resolveStoryFacts({
      userMessage: "hinglish",
      memory,
      turnRequestId: "turn_abc",
    });
    memory = writeFidelityState(memory, {
      ...r.state,
      lastValidationSummary: {
        valid: false,
        score: 0.2,
        violationCodes: ["LANGUAGE_FULL_ENGLISH"],
        repairAttempted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    const state = readFidelityState(memory);
    expect(state.resolvedFacts.language.storyLanguage).toBe("hinglish");
    expect(state.lastValidationSummary?.violationCodes).toContain(
      "LANGUAGE_FULL_ENGLISH"
    );
    expect(JSON.stringify(state)).not.toMatch(/SYSTEM:|API_KEY/);
  });

  it("tool framework remains compatible when fidelity on", async () => {
    const { planStoryTools } = await import("@/lib/tools");
    const memory = emptyStoryMemory();
    const rename = planStoryTools({
      intent: "update_character",
      userMessage: "Rename Azar to Aariz",
      memory,
    });
    expect(rename.requiresTools).toBe(true);
  });

  it("provider router helper still available", async () => {
    const mod = await import("@/lib/provider-router/v2/legacy-generate");
    expect(typeof mod.generateTextCompat).toBe("function");
  });

  it("extractExplicitFacts covers format phrases", () => {
    expect(
      extractExplicitFactsFromMessage("emotion in brackets").emotionBrackets
    ).toBe(true);
    expect(
      extractExplicitFactsFromMessage("episode scene me divided").sceneDivisions
    ).toBe(true);
  });

  it("single repair success path: bad→good validation", () => {
    let memory = emptyStoryMemory();
    for (const msg of [
      "azar main lead male and anaya female main lead",
      "college",
      "hinglish",
      "character uppercase me aayge, uske just niche dialogues",
      "emotion in brackets",
      "episode scene me divided",
      "start the story",
    ]) {
      const r = resolveStoryFacts({ userMessage: msg, memory });
      memory = writeFidelityState(memory, r.state);
    }
    const contract = buildStoryGenerationContract({
      facts: readFidelityState(memory).resolvedFacts,
      operation: "write_episode",
      latestInstruction: "start the story",
    });
    const first = validateStoryOutput({
      content: GENERIC_BAD_DRAFT,
      contract,
    });
    expect(first.valid).toBe(false);
    expect(first.repairable).toBe(true);
    const repaired = validateStoryOutput({
      content: VALID_HINGLISH_EPISODE,
      contract,
    });
    expect(repaired.valid).toBe(true);
  });

  it("flag off preserves legacy prompt mapping", () => {
    process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED = "false";
    expect(resolvePromptId({ intent: "write_scene" })).toBe("creative.scene");
  });

  it("strict prompt builds with contract section", () => {
    const def = getPromptDefinition("story.generation.strict");
    expect(def).toBeTruthy();
    const result = buildPrompt({
      promptId: "story.generation.strict",
      intent: "write_scene",
      operation: "write_scene",
      userMessage: "start the story",
      context: {
        contextVersion: 2,
        operation: "write_scene",
        story: {
          title: null,
          concept: null,
          genre: [],
          tone: [],
          themes: [],
          setting: "college",
        },
        characters: [
          {
            id: "1",
            name: "Azar",
            aliases: [],
            personalityTraits: [],
            goals: [],
            fears: [],
            strengths: [],
            weaknesses: [],
            notes: [],
            avoid: [],
            role: "male_lead",
          },
        ],
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
        instructionContract: "REQUIRED:\n- Main male lead: AZAR",
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
    expect(result.messages.map((m) => m.content).join("\n")).toMatch(/AZAR|CONTRACT/);
  });
});
