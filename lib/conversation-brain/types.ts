/**
 * Conversation Brain — shared types (Phase 0 + A + B).
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type { IntentRouteResult, IntentSource, StoryIntent } from "@/lib/conversation-brain/intents";
import type { NormalizedTurnResult } from "@/lib/story-agent/operation-result";
import type { StoryOperation } from "@/lib/story-agent/operations";
import type { StoryMemory } from "@/lib/story-agent/schema";
import type {
  AwaitingResolution,
  OfferResolution,
} from "@/lib/conversation-brain/offer-resolver";
import type { OpenConceptDetection } from "@/lib/conversation-brain/open-concept";
import type { CanonicalStoryContext } from "@/lib/story-agent/canonical-story-context";

export const BRAIN_INTENTS = [
  "greeting",
  "normal_chat",
  "brainstorm",
  "character_creation",
  "relationship",
  "world_building",
  "episode",
  "scene",
  "rewrite",
  "continue",
  "dialogue",
  "description",
  "summary",
  "question_answer",
  "memory_update",
  "correction",
  "delete_memory",
  "story_search",
  "story_facts",
  "language_change",
  "style_change",
  "tone_change",
  "humor",
  "romance",
  "thriller",
  "do_not_start",
  "create_story",
  "save_episode",
  "inspect_memory",
  "unknown",
] as const;

export type BrainIntent = (typeof BRAIN_INTENTS)[number];

export type PlanConfidence = number;

export type TurnPlan = {
  /** Legacy Phase 0/A intent label (compat). Prefer storyIntent. */
  intent: BrainIntent;
  /** Canonical Phase B intent */
  storyIntent?: StoryIntent;
  operation: StoryOperation;
  confidence: PlanConfidence;
  needsMemory: boolean;
  needsCreativeGeneration: boolean;
  needsClarification: boolean;
  question: string | null;
  deterministicHandled: boolean;
  aiRequired: boolean;
  matchedSignals: string[];
  plannerSource:
    | "deterministic"
    | "intent_router"
    | "hybrid"
    | "offer_resolver"
    | "contextual"
    | "llm"
    | "fallback";
  /** Routing source from unified intent router */
  intentSource?: IntentSource;
  /** Full validated route result (never includes private prompts) */
  intentRoute?: IntentRouteResult;
  continueTarget?: "scene" | "episode" | "draft" | "conversation" | null;
  /** Phase A: collaborative brainstorm path */
  collaborationMode?: boolean;
  openConcept?: OpenConceptDetection | null;
  offerResolution?: OfferResolution | null;
  awaitingResolution?: AwaitingResolution | null;
  /** Clear generation block */
  clearGenerationBlock?: boolean;
  /** Set generation block */
  setGenerationBlock?: boolean;
};

export type ConversationTurnRequest = {
  userId: string;
  conversationId: string;
  storyId: string | null;
  memory: StoryMemory;
  userMessage: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  turnRequestId: string;
  conversationFlow?: ConversationFlow;
  /** Persisted raw canon, reconstructed for older conversations when absent. */
  canonicalStoryContext?: CanonicalStoryContext;
};

export type ConversationTurnResult = NormalizedTurnResult & {
  plan: TurnPlan;
  brainVersion: "0";
  conversationFlow: ConversationFlow;
};

export const BRAIN_VERSION = "0" as const;
