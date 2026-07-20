/**
 * Conversation Brain adapter for Instruction Fidelity (Phase G.5).
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import { mergeConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type { TurnPlan } from "@/lib/conversation-brain/types";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { shouldSuppressClarification } from "@/lib/story-fidelity/answered-questions";
import { evaluateStoryReadiness } from "@/lib/story-fidelity/readiness-gate";
import {
  resolveStoryFacts,
  writeFidelityState,
} from "@/lib/story-fidelity/resolve-facts";
import type { StoryReadinessResult } from "@/lib/story-fidelity/schemas";
import { isCreativeStoryIntent } from "@/lib/conversation-brain/intents";

export type FidelityPreTurnResult = {
  memory: StoryMemory;
  plan: TurnPlan;
  flow: ConversationFlow;
  readiness: StoryReadinessResult;
  /** When true, brain should return planning-only conversational reply */
  blockCreativeGeneration: boolean;
  planningReply?: string;
};

export function applyInstructionFidelityPreTurn(params: {
  memory: StoryMemory;
  userMessage: string;
  plan: TurnPlan;
  flow: ConversationFlow;
  turnRequestId?: string;
}): FidelityPreTurnResult {
  const { facts, state } = resolveStoryFacts({
    userMessage: params.userMessage,
    memory: params.memory,
    turnRequestId: params.turnRequestId,
  });

  const memory = writeFidelityState(params.memory, state);
  let plan = { ...params.plan };
  let flow = params.flow;

  // Suppress repeated clarification questions
  if (plan.needsClarification && plan.question) {
    const suppress = shouldSuppressClarification({
      question: plan.question,
      facts,
      answered: state.answeredQuestions,
    });
    if (suppress.suppress) {
      plan = {
        ...plan,
        needsClarification: false,
        question: null,
        aiRequired: plan.aiRequired || plan.needsCreativeGeneration,
      };
    }
  }

  // Sync generation block from facts
  if (facts.conversationRules.doNotStartStoryYet) {
    flow = mergeConversationFlow(flow, {
      generationBlocked: true,
      phase: "exploring",
    });
  } else if (
    facts.storyStatus === "writing" ||
    facts.storyStatus === "ready"
  ) {
    flow = mergeConversationFlow(flow, {
      generationBlocked: false,
      phase: "ready_to_write",
    });
  }

  const intent = String(plan.storyIntent || plan.intent);
  const readiness = evaluateStoryReadiness({
    facts,
    userMessage: params.userMessage,
    intent,
  });

  const wantsCreative =
    plan.needsCreativeGeneration ||
    isCreativeStoryIntent(intent as never) ||
    intent === "write_episode" ||
    intent === "write_scene" ||
    intent === "continue_story";

  let blockCreativeGeneration = false;
  let planningReply: string | undefined;

  if (wantsCreative && !readiness.generationAllowed) {
    blockCreativeGeneration = true;
    planningReply =
      readiness.mode === "planning_only"
        ? "Theek hai — abhi story start nahi karenge. Confirmed details lock rahenge (characters, setting, language, format). Jab ready ho, “start the story” bol dena."
        : "Abhi generation pause pe hai. Confirmed facts safe hain — batao kya polish karna hai, ya “start the story” bolo.";
  }

  return {
    memory,
    plan,
    flow,
    readiness,
    blockCreativeGeneration,
    planningReply,
  };
}
