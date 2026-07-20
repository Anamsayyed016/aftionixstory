/**
 * Phase B — Unified Hybrid Intent Router tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CONVERSATION_FLOW,
  type ConversationFlow,
} from "@/lib/conversation-brain/collaboration-state";
import { buildIntentContext } from "@/lib/conversation-brain/intent-context";
import {
  getIntentConfidenceThreshold,
  isIntentClassifierEnabled,
} from "@/lib/conversation-brain/intent-classifier";
import {
  routeStoryIntent,
  routeStoryIntentSync,
} from "@/lib/conversation-brain/intent-router";
import { planConversationTurn } from "@/lib/conversation-brain/planner";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";

const classifyMock = vi.fn();

vi.mock("@/lib/conversation-brain/intent-classifier", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/conversation-brain/intent-classifier")>();
  return {
    ...actual,
    classifyIntentWithLlm: (...args: unknown[]) => classifyMock(...args),
  };
});

function flowWithOffers(): ConversationFlow {
  return {
    ...DEFAULT_CONVERSATION_FLOW,
    phase: "exploring",
    lastOfferType: "pairings",
    lastOffers: [
      {
        id: "1",
        label: "CEO × Intern",
        value: "ceo_intern",
        prompt: "CEO × Intern",
      },
      {
        id: "2",
        label: "Mafia × Doctor",
        value: "mafia_doctor",
        prompt: "Mafia × Doctor",
      },
    ],
    awaiting: { type: "choice", topic: "pairing" },
  };
}

function memoryWithDraft() {
  const memory = emptyStoryMemory();
  memory.latestDraft = {
    title: "Scene",
    content: "Enough draft content for revision and continue tests here.",
    wordCount: 12,
  };
  return memory;
}

function memoryWithAzar() {
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
  ];
  return memory;
}

describe("Phase B — unified intent router", () => {
  beforeEach(() => {
    classifyMock.mockReset();
    process.env.AI_INTENT_CLASSIFIER_ENABLED = "true";
    process.env.AI_INTENT_CONFIDENCE_THRESHOLD = "0.55";
  });

  afterEach(() => {
    classifyMock.mockReset();
  });

  it("1. hey → greeting deterministic, no classifier", async () => {
    const plan = planConversationTurn("hey");
    expect(plan.storyIntent).toBe("greeting");
    expect(plan.intent).toBe("greeting");
    expect(plan.intentSource).toBe("deterministic");
    const asyncRoute = await routeStoryIntent({
      userMessage: "hey",
      skipClassifier: false,
    });
    expect(asyncRoute.route.intent).toBe("greeting");
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("2. forbidden romance → brainstorm / Phase A preserved", () => {
    const plan = planConversationTurn("I want forbidden romance");
    expect(plan.intent).toBe("brainstorm");
    expect(plan.collaborationMode).toBe(true);
    expect(plan.operation).toBe("brainstorm");
  });

  it("3. CEO and intern with lastOffers → offer resolution, no classifier", async () => {
    const flow = flowWithOffers();
    const plan = planConversationTurn("CEO and intern", emptyStoryMemory(), flow);
    expect(plan.offerResolution?.offer.value).toBe("ceo_intern");
    expect(plan.plannerSource).toBe("offer_resolver");
    await routeStoryIntent({
      userMessage: "CEO and intern",
      memory: emptyStoryMemory(),
      flow,
    });
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("4. The intern while awaiting who_falls_first → awaiting wins", async () => {
    const flow: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      awaiting: { type: "choice", topic: "who_falls_first" },
      lastOffers: [],
    };
    const plan = planConversationTurn("The intern", emptyStoryMemory(), flow);
    expect(plan.awaitingResolution?.value).toBe("intern");
    await routeStoryIntent({
      userMessage: "The intern",
      memory: emptyStoryMemory(),
      flow,
    });
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("5. Story start mat karna → block_generation", () => {
    const plan = planConversationTurn("Story start mat karna");
    expect(plan.storyIntent).toBe("block_generation");
    expect(plan.intent).toBe("do_not_start");
    expect(plan.setGenerationBlock).toBe(true);
  });

  it("6. Start now while blocked → unblock", () => {
    const flow: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      generationBlocked: true,
    };
    const plan = planConversationTurn("Start now", emptyStoryMemory(), flow);
    expect(plan.clearGenerationBlock).toBe(true);
    expect(plan.storyIntent).toBe("unblock_generation");
  });

  it("7. Write a scene while blocked → blocked response path", () => {
    const flow: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      generationBlocked: true,
    };
    const plan = planConversationTurn(
      "Write a scene",
      emptyStoryMemory(),
      flow
    );
    expect(plan.matchedSignals).toContain("generation_blocked");
    expect(plan.needsCreativeGeneration).toBe(false);
  });

  it("8. Make it more emotional with draft → make_emotional needsDraft", () => {
    const route = routeStoryIntentSync({
      userMessage: "Make it more emotional",
      memory: memoryWithDraft(),
    });
    expect(route.route.intent).toBe("make_emotional");
    expect(route.route.needsDraft).toBe(true);
    expect(route.route.source).toBe("deterministic");
  });

  it("9. Make it more emotional without draft → tone_change", () => {
    const route = routeStoryIntentSync({
      userMessage: "Make it more emotional",
      memory: emptyStoryMemory(),
    });
    expect(route.route.intent).toBe("tone_change");
    expect(route.route.needsDraft).toBe(false);
  });

  it("10. Rewrite the last paragraph with draft → rewrite", () => {
    const route = routeStoryIntentSync({
      userMessage: "Rewrite the last paragraph",
      memory: memoryWithDraft(),
    });
    expect(route.route.intent).toBe("rewrite");
    expect(route.route.needsDraft).toBe(true);
  });

  it("11. Continue with draft → continue_story", () => {
    const plan = planConversationTurn("Continue", memoryWithDraft());
    expect(plan.storyIntent).toBe("continue_story");
    expect(plan.intent).toBe("continue");
    expect(plan.continueTarget).toBe("draft");
  });

  it("12. Continue without story/draft → clarification", () => {
    const plan = planConversationTurn("Continue", emptyStoryMemory());
    expect(plan.needsClarification).toBe(true);
    expect(plan.needsCreativeGeneration).toBe(false);
    expect(plan.question).toBeTruthy();
  });

  it("13. Anaya correction → memory_correction", () => {
    const route = routeStoryIntentSync({
      userMessage: "Anaya is not his sister. She is his daughter.",
    });
    expect(route.route.intent).toBe("memory_correction");
    expect(route.route.source).toBe("deterministic");
  });

  it("14. Anaya is innocent and strong → update_character or memory_update", () => {
    const route = routeStoryIntentSync({
      userMessage: "Anaya is innocent and strong.",
    });
    expect(["update_character", "memory_update"]).toContain(route.route.intent);
  });

  it("15. Hinglish me likho → language_change deterministic", () => {
    const plan = planConversationTurn("Hinglish me likho");
    expect(plan.intent).toBe("language_change");
    expect(plan.intentSource).toBe("deterministic");
    expect(plan.aiRequired).toBe(false);
  });

  it("16. What happened in episode 3? → episode_question + number", () => {
    const route = routeStoryIntentSync({
      userMessage: "What happened in episode 3?",
      storyId: "story_1",
    });
    expect(route.route.intent).toBe("episode_question");
    expect(route.route.entities.episodeNumber).toBe(3);
  });

  it("17. Who is Azar? with known character → character_question", () => {
    const route = routeStoryIntentSync({
      userMessage: "Who is Azar?",
      memory: memoryWithAzar(),
    });
    expect(route.route.intent).toBe("character_question");
    expect(route.route.entities.characterNames).toContain("Azar");
  });

  it("18. Give me three twists → generate_twist", () => {
    const route = routeStoryIntentSync({
      userMessage: "Give me three twists",
    });
    expect(route.route.intent).toBe("generate_twist");
  });

  it("19. Create a dark royal world → world_building", () => {
    const route = routeStoryIntentSync({
      userMessage: "Create a dark royal world",
    });
    expect(route.route.intent).toBe("world_building");
  });

  it("20. Shorter with draft → shorten", () => {
    const route = routeStoryIntentSync({
      userMessage: "Shorter",
      memory: memoryWithDraft(),
    });
    expect(route.route.intent).toBe("shorten");
    expect(route.route.needsDraft).toBe(true);
  });

  it("21. Shorter without draft → clarification", () => {
    const route = routeStoryIntentSync({
      userMessage: "Shorter",
      memory: emptyStoryMemory(),
    });
    expect(route.route.needsClarification).toBe(true);
    expect(route.route.creativeGeneration).toBe(false);
  });

  it("22. Make it different with draft → contextual revision", () => {
    const route = routeStoryIntentSync({
      userMessage: "Make it different",
      memory: memoryWithDraft(),
    });
    expect(route.route.intent).toBe("revise_style");
    expect(route.route.source).toBe("contextual");
    expect(route.route.needsDraft).toBe(true);
  });

  it("23. Make it different without draft → clarification or LLM path", async () => {
    classifyMock.mockResolvedValue(null);
    const sync = routeStoryIntentSync({
      userMessage: "Make it different",
      memory: emptyStoryMemory(),
    });
    expect(sync.route.confidence).toBeLessThan(getIntentConfidenceThreshold());
    expect(
      sync.route.needsClarification ||
        sync.route.matchedSignals.includes("needs_llm_classifier") ||
        sync.route.intent === "normal_chat"
    ).toBe(true);

    await routeStoryIntent({
      userMessage: "Make it different",
      memory: emptyStoryMemory(),
    });
    // Low confidence should attempt classifier when enabled
    expect(classifyMock).toHaveBeenCalled();
  });

  it("24. Classifier malformed → safe fallback, turn succeeds", async () => {
    classifyMock.mockResolvedValue(null);
    const result = await routeStoryIntent({
      userMessage: "Make it different",
      memory: emptyStoryMemory(),
      turnRequestId: "t_malformed",
    });
    expect(result.route.intent).toBeTruthy();
    expect(result.classifierMeta.ok).toBe(false);
  });

  it("25. Classifier timeout → safe fallback", async () => {
    classifyMock.mockResolvedValue(null);
    const result = await routeStoryIntent({
      userMessage: "Make it different",
      memory: emptyStoryMemory(),
      turnRequestId: "t_timeout",
    });
    expect(result.route.intent).toBe("normal_chat");
    expect(result.route.creativeGeneration).toBe(false);
  });

  it("26. High-confidence deterministic → classifier invocation count 0", async () => {
    await routeStoryIntent({ userMessage: "hey" });
    await routeStoryIntent({ userMessage: "Hinglish me likho" });
    await routeStoryIntent({
      userMessage: "Story start mat karna",
    });
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("27. Repeated turnRequestId → identical routing (no side effects)", async () => {
    const a = await routeStoryIntent({
      userMessage: "hey",
      turnRequestId: "same_id",
    });
    const b = await routeStoryIntent({
      userMessage: "hey",
      turnRequestId: "same_id",
    });
    expect(a.route.intent).toBe(b.route.intent);
    expect(a.route.confidence).toBe(b.route.confidence);
    expect(a.route.source).toBe(b.route.source);
  });

  it("28. Conversation A/B intent context isolated", () => {
    const flowA = flowWithOffers();
    const flowB: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      lastOffers: [],
    };
    const a = routeStoryIntentSync({
      userMessage: "CEO and intern",
      flow: flowA,
    });
    const b = routeStoryIntentSync({
      userMessage: "CEO and intern",
      flow: flowB,
    });
    expect(a.route.intent).toBe("offer_selection");
    expect(b.route.intent).not.toBe("offer_selection");
    expect(a.context.lastOfferLabels.length).toBeGreaterThan(0);
    expect(b.context.lastOfferLabels.length).toBe(0);
  });

  it("29. Phase A offer chips after refresh shape unchanged", () => {
    const flow = flowWithOffers();
    const plan = planConversationTurn("CEO and intern", emptyStoryMemory(), flow);
    expect(plan.offerResolution?.offer.label).toMatch(/CEO/i);
    expect(plan.operation).toBe("memory_update");
    expect(plan.collaborationMode).toBe(true);
  });

  it("30. Compatibility: storyIntent maps to existing operations", () => {
    expect(planConversationTurn("hey").operation).toBe("conversational_chat");
    expect(planConversationTurn("I want forbidden romance").operation).toBe(
      "brainstorm"
    );
    expect(planConversationTurn("Hinglish me likho").operation).toBe(
      "memory_update"
    );
    const cont = planConversationTurn("Continue", memoryWithDraft());
    expect(["continue_episode", "revise_draft", "conversational_chat"]).toContain(
      cont.operation
    );
  });
});

describe("Phase B — IntentContext + flags", () => {
  it("builds compact IntentContext", () => {
    const ctx = buildIntentContext({
      memory: memoryWithDraft(),
      flow: {
        ...DEFAULT_CONVERSATION_FLOW,
        generationBlocked: true,
        lastIntent: "brainstorm",
      },
      storyId: "s1",
    });
    expect(ctx.hasLatestDraft).toBe(true);
    expect(ctx.hasLinkedStory).toBe(true);
    expect(ctx.generationBlocked).toBe(true);
    expect(ctx.lastIntent).toBe("brainstorm");
  });

  it("respects classifier feature flag", () => {
    process.env.AI_INTENT_CLASSIFIER_ENABLED = "false";
    expect(isIntentClassifierEnabled()).toBe(false);
    process.env.AI_INTENT_CLASSIFIER_ENABLED = "true";
    expect(isIntentClassifierEnabled()).toBe(true);
  });
});
