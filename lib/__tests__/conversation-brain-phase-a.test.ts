import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONVERSATION_FLOW,
  mergeConversationFlow,
  readConversationFlow,
  type ConversationFlow,
} from "@/lib/conversation-brain/collaboration-state";
import {
  resolveAwaitingAnswer,
  resolveOfferSelection,
} from "@/lib/conversation-brain/offer-resolver";
import {
  COLLABORATIVE_FAILURE_USER_MESSAGE,
  detectOpenConcept,
  looksLikeWizardChecklist,
} from "@/lib/conversation-brain/open-concept";
import { planConversationTurn } from "@/lib/conversation-brain/planner";
import {
  buildOfferSelectionReply,
  buildTwoCharactersReply,
} from "@/lib/conversation-brain/phase-a-turn";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { PROVIDER_FAILURE_USER_MESSAGE } from "@/lib/story-agent/concept-reply";

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
      {
        id: "3",
        label: "Prince × Commoner",
        value: "prince_commoner",
        prompt: "Prince × Commoner",
      },
    ],
    awaiting: { type: "choice", topic: "pairing" },
  };
}

describe("Phase A — open concept detection", () => {
  it("routes forbidden romance as open concept", () => {
    const d = detectOpenConcept("I want forbidden romance.");
    expect(d.matched).toBe(true);
    expect(d.preferOfferType).toBe("pairings");
    const plan = planConversationTurn("I want forbidden romance.");
    expect(plan.operation).toBe("brainstorm");
    expect(plan.collaborationMode).toBe(true);
    expect(plan.intent).toBe("brainstorm");
  });

  it("routes two characters collaboratively", () => {
    const d = detectOpenConcept("I only have two characters.");
    expect(d.kind).toBe("two_characters");
    const plan = planConversationTurn("I only have two characters.");
    expect(plan.collaborationMode).toBe(true);
    expect(plan.aiRequired).toBe(false);
  });

  it("routes horror without romance hardcoding", () => {
    const d = detectOpenConcept("Help me create a horror story.");
    expect(d.matched).toBe(true);
    expect(d.genreHints.some((g) => /horror/i.test(g))).toBe(true);
    expect(d.preferOfferType).not.toBe("pairings");
  });

  it("routes suggest unique", () => {
    const d = detectOpenConcept("Suggest something unique.");
    expect(d.matched).toBe(true);
    expect(d.kind).toBe("suggest_unique");
  });

  it("does not treat hey as open concept", () => {
    expect(detectOpenConcept("hey").matched).toBe(false);
    expect(planConversationTurn("hey").intent).toBe("greeting");
  });
});

describe("Phase A — offer resolution", () => {
  it("resolves CEO and intern against lastOffers", () => {
    const flow = flowWithOffers();
    const hit = resolveOfferSelection("CEO and intern", flow);
    expect(hit?.offer.label).toMatch(/CEO/i);
    const plan = planConversationTurn("CEO and intern", emptyStoryMemory(), flow);
    expect(plan.offerResolution?.offer.value).toBe("ceo_intern");
    expect(plan.plannerSource).toBe("offer_resolver");
    expect(plan.operation).toBe("memory_update");
  });

  it("without lastOffers, CEO and intern stays deterministic memory", () => {
    const plan = planConversationTurn("CEO and intern");
    expect(plan.offerResolution).toBeFalsy();
    expect(plan.intent).toBe("memory_update");
    expect(plan.plannerSource).toBe("deterministic");
  });

  it("resolves the intern for who_falls_first", () => {
    const flow: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      awaiting: { type: "choice", topic: "who_falls_first" },
      lastOffers: [],
    };
    const hit = resolveAwaitingAnswer("The intern.", flow);
    expect(hit?.value).toBe("intern");
    const plan = planConversationTurn("The intern.", emptyStoryMemory(), flow);
    expect(plan.awaitingResolution?.value).toBe("intern");
  });

  it("builds natural offer selection follow-up", () => {
    const built = buildOfferSelectionReply(
      {
        id: "1",
        label: "CEO × Intern",
        value: "ceo_intern",
        prompt: "CEO × Intern",
      },
      emptyStoryMemory()
    );
    expect(built.reply.toLowerCase()).toMatch(/ceo|intern|falls first/);
    expect(built.reply.toLowerCase()).not.toContain("working title");
    expect(built.memory.characters.length).toBe(2);
    expect(built.flowPatch.awaiting?.topic).toBe("who_falls_first");
  });
});

describe("Phase A — two characters reply", () => {
  it("encourages and offers dynamics", () => {
    const built = buildTwoCharactersReply();
    expect(built.reply.toLowerCase()).toMatch(/two|do characters|slow-burn/);
    expect(built.offers.length).toBeGreaterThanOrEqual(3);
    expect(built.offers.length).toBeLessThanOrEqual(4);
  });
});

describe("Phase A — do-not-start / unblock", () => {
  it("blocks generation on story start mat karna", () => {
    const plan = planConversationTurn("Story start mat karna abhi.");
    expect(plan.intent).toBe("do_not_start");
    expect(plan.setGenerationBlock).toBe(true);
    expect(plan.aiRequired).toBe(false);
  });

  it("clears block on start now", () => {
    const flow: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      generationBlocked: true,
    };
    const plan = planConversationTurn("Start now.", emptyStoryMemory(), flow);
    expect(plan.clearGenerationBlock).toBe(true);
  });

  it("blocks creative ops while generationBlocked", () => {
    const flow: ConversationFlow = {
      ...DEFAULT_CONVERSATION_FLOW,
      generationBlocked: true,
    };
    const plan = planConversationTurn(
      "Write a short scene between them",
      emptyStoryMemory(),
      flow
    );
    expect(plan.matchedSignals).toContain("generation_blocked");
    expect(plan.needsCreativeGeneration).toBe(false);
  });
});

describe("Phase A — anti-wizard + errors", () => {
  it("detects checklist replies", () => {
    expect(
      looksLikeWizardChecklist(
        "Please provide: title, genre, language, POV, and at least one main character"
      )
    ).toBe(true);
    expect(
      looksLikeWizardChecklist(
        "Forbidden romance can go in many directions. Want CEO × Intern?"
      )
    ).toBe(false);
  });

  it("uses collaborative failure copy distinct from provider finish message", () => {
    expect(COLLABORATIVE_FAILURE_USER_MESSAGE.toLowerCase()).toContain(
      "properly"
    );
    expect(PROVIDER_FAILURE_USER_MESSAGE).not.toBe(
      COLLABORATIVE_FAILURE_USER_MESSAGE
    );
  });
});

describe("Phase A — conversationFlow persistence helpers", () => {
  it("reads and merges flow without erasing memory shape", () => {
    const state = {
      storyMemory: { concept: "test", genre: [] },
      characters: [],
      conversationFlow: {
        phase: "exploring",
        lastOfferType: "pairings",
        lastOffers: [
          { id: "a", label: "Rivals", value: "rivals", prompt: "Rivals" },
        ],
        awaiting: { type: "choice", topic: "pairing" },
        generationBlocked: false,
      },
    };
    const flow = readConversationFlow(state);
    expect(flow.phase).toBe("exploring");
    expect(flow.lastOffers[0]?.label).toBe("Rivals");
    const merged = mergeConversationFlow(flow, {
      generationBlocked: true,
      phase: "shaping",
    });
    expect(merged.generationBlocked).toBe(true);
    expect(merged.lastOffers[0]?.label).toBe("Rivals");
  });

  it("isolates offers per flow object (no cross-conversation leakage)", () => {
    const a = flowWithOffers();
    const b = { ...DEFAULT_CONVERSATION_FLOW, lastOffers: [] as ConversationFlow["lastOffers"] };
    expect(resolveOfferSelection("CEO and intern", a)).toBeTruthy();
    expect(resolveOfferSelection("CEO and intern", b)).toBeNull();
  });
});
