/**
 * Planner — Phase 0/A/B. Builds TurnPlan from the unified hybrid intent router.
 * No second planner; LLM classification lives in intent-router / intent-classifier.
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import {
  getIntentConfidenceThreshold,
} from "@/lib/conversation-brain/intent-classifier";
import {
  routeStoryIntent,
  routeStoryIntentSync,
  type UnifiedRouteResult,
} from "@/lib/conversation-brain/intent-router";
import {
  storyIntentToOperation,
  type IntentRouteResult,
  type StoryIntent,
} from "@/lib/conversation-brain/intents";
import type { StoryOperation } from "@/lib/story-agent/operations";
import type { StoryMemory } from "@/lib/story-agent/schema";
import type { BrainIntent, TurnPlan } from "@/lib/conversation-brain/types";

/** Map canonical StoryIntent → legacy BrainIntent for Phase 0/A compatibility. */
export function storyIntentToBrainIntent(intent: StoryIntent): BrainIntent {
  switch (intent) {
    case "greeting":
      return "greeting";
    case "help":
    case "normal_chat":
    case "unknown":
    case "general_question":
      return "normal_chat";
    case "brainstorm":
    case "generate_plot":
    case "generate_title":
    case "generate_twist":
    case "generate_ending":
      return "brainstorm";
    case "world_building":
      return "world_building";
    case "create_character":
    case "update_character":
      return "character_creation";
    case "create_relationship":
    case "update_relationship":
      return "relationship";
    case "write_scene":
    case "generate_dialogue":
    case "generate_description":
      return "scene";
    case "write_episode":
      return "episode";
    case "continue_story":
      return "continue";
    case "rewrite":
    case "revise_tone":
    case "revise_style":
    case "make_emotional":
    case "make_romantic":
    case "make_funny":
    case "shorten":
    case "expand":
      return "rewrite";
    case "story_question":
    case "character_question":
    case "episode_question":
    case "relationship_question":
    case "search_story":
      return "question_answer";
    case "summarize_story":
    case "summarize_episode":
      return "summary";
    case "memory_update":
    case "offer_selection":
    case "awaiting_answer":
      return "memory_update";
    case "memory_correction":
      return "correction";
    case "memory_delete":
      return "delete_memory";
    case "language_change":
      return "language_change";
    case "style_change":
      return "style_change";
    case "tone_change":
      return "tone_change";
    case "block_generation":
      return "do_not_start";
    case "unblock_generation":
    case "retry":
    case "cancel":
      return "normal_chat";
    default:
      return "unknown";
  }
}

function plannerSourceFromRoute(
  route: IntentRouteResult
): TurnPlan["plannerSource"] {
  if (route.source === "offer_resolver") return "offer_resolver";
  if (route.source === "deterministic") return "deterministic";
  if (route.source === "contextual") return "contextual";
  if (route.source === "llm") return "llm";
  if (route.source === "fallback") return "fallback";
  return "hybrid";
}

function resolveContinueTarget(
  memory: StoryMemory | null | undefined,
  intent: StoryIntent
): TurnPlan["continueTarget"] {
  if (intent === "write_scene") return "scene";
  if (
    intent !== "continue_story" &&
    intent !== "rewrite" &&
    intent !== "make_emotional" &&
    intent !== "make_romantic" &&
    intent !== "make_funny" &&
    intent !== "shorten" &&
    intent !== "expand" &&
    intent !== "revise_tone" &&
    intent !== "revise_style"
  ) {
    return null;
  }
  if (memory?.latestDraft?.content?.trim()) return "draft";
  if (memory?.storyMemory?.storyStatus === "created") return "episode";
  return "conversation";
}

function clarificationQuestion(reason: string | null): string | null {
  switch (reason) {
    case "nothing_to_continue":
      return "Abhi continue karne ke liye koi draft ya episode nahi hai. Pehle ek scene likhein, ya concept share karein?";
    case "no_draft_to_rewrite":
    case "no_draft_for_revision":
    case "no_draft_to_shorten":
    case "no_draft_to_expand":
      return "Abhi koi draft nahi hai jisey revise kar saken. Pehle ek short scene likhein?";
    case "no_story_for_episode_question":
      return "Episode ke baare me sawal ka jawab dena hai, lekin abhi koi linked story nahi hai. Concept ya characters share karein?";
    case "memory_delete_no_target":
      return "Kya delete karna hai — character, fact, ya preference? Ek short detail bata dein.";
    case "ambiguous_without_draft":
      return "Kya change chahiye — tone, length, ya naya scene? Thoda clear karein.";
    default:
      return reason ? "Thoda clear karein — main usi hisaab se help karungi." : null;
  }
}

function buildTurnPlanFromUnified(
  unified: UnifiedRouteResult,
  memory?: StoryMemory | null
): TurnPlan {
  const { route, extras } = unified;
  const operation: StoryOperation =
    extras.offerResolution || extras.awaitingResolution
      ? "memory_update"
      : extras.collaborationMode && route.intent === "brainstorm"
        ? "brainstorm"
        : storyIntentToOperation(route.intent);

  const brainIntent = storyIntentToBrainIntent(route.intent);
  const deterministicHandled =
    route.source === "deterministic" ||
    route.source === "offer_resolver" ||
    Boolean(extras.clearGenerationBlock) ||
    route.matchedSignals.includes("generation_blocked");

  return {
    intent: brainIntent,
    storyIntent: route.intent,
    operation,
    confidence: route.confidence,
    needsMemory: route.needsMemory,
    needsCreativeGeneration: route.creativeGeneration,
    needsClarification: route.needsClarification,
    question: route.needsClarification
      ? clarificationQuestion(route.clarificationReason)
      : null,
    deterministicHandled,
    aiRequired: route.aiRequired && !route.needsClarification,
    matchedSignals: route.matchedSignals,
    plannerSource: plannerSourceFromRoute(route),
    intentSource: route.source,
    intentRoute: route,
    continueTarget: resolveContinueTarget(memory, route.intent),
    collaborationMode: Boolean(extras.collaborationMode),
    openConcept: extras.openConcept ?? null,
    offerResolution: extras.offerResolution ?? null,
    awaitingResolution: extras.awaitingResolution ?? null,
    clearGenerationBlock: Boolean(extras.clearGenerationBlock),
    setGenerationBlock:
      Boolean(extras.setGenerationBlock) || route.intent === "block_generation",
  };
}

/**
 * Sync plan (no LLM classifier). Preferred for unit tests of deterministic paths.
 */
export function planConversationTurn(
  userMessage: string,
  memory?: StoryMemory | null,
  flow: ConversationFlow = DEFAULT_CONVERSATION_FLOW,
  opts?: { storyId?: string | null; recentMessages?: Array<{ role: string; content: string }> }
): TurnPlan {
  const unified = routeStoryIntentSync({
    userMessage,
    memory,
    flow,
    storyId: opts?.storyId,
    recentMessages: opts?.recentMessages,
  });
  return buildTurnPlanFromUnified(unified, memory);
}

/**
 * Full plan including optional LLM classifier for low-confidence messages.
 */
export async function planConversationTurnAsync(
  userMessage: string,
  memory?: StoryMemory | null,
  flow: ConversationFlow = DEFAULT_CONVERSATION_FLOW,
  opts?: {
    storyId?: string | null;
    recentMessages?: Array<{ role: string; content: string }>;
    turnRequestId?: string;
    skipClassifier?: boolean;
  }
): Promise<TurnPlan> {
  const unified = await routeStoryIntent({
    userMessage,
    memory,
    flow,
    storyId: opts?.storyId,
    recentMessages: opts?.recentMessages,
    turnRequestId: opts?.turnRequestId,
    skipClassifier: opts?.skipClassifier,
  });
  return buildTurnPlanFromUnified(unified, memory);
}

export function shouldUseLlmIntentClassifier(plan: TurnPlan): boolean {
  if (
    plan.plannerSource === "deterministic" ||
    plan.plannerSource === "offer_resolver"
  ) {
    return false;
  }
  if (plan.intentSource === "llm") return false;
  return plan.confidence < getIntentConfidenceThreshold();
}
