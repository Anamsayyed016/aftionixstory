/**
 * Top-level universal chat intents (Phase 1 platform router).
 * Distinct from Conversation Brain's story-centric StoryIntent set.
 */

export const UNIVERSAL_INTENTS = [
  "story_request",
  "story_continuation",
  "general_question",
  "coding_help",
  "current_information",
  "platform_question",
  "unclear",
] as const;

export type UniversalIntent = (typeof UNIVERSAL_INTENTS)[number];

export function isStoryUniversalIntent(intent: UniversalIntent): boolean {
  return intent === "story_request" || intent === "story_continuation";
}

export function isGeneralAiIntent(intent: UniversalIntent): boolean {
  return (
    intent === "general_question" ||
    intent === "coding_help" ||
    intent === "current_information" ||
    intent === "platform_question" ||
    intent === "unclear"
  );
}

export type UniversalRouteDecision = {
  intent: UniversalIntent;
  confidence: number;
  source: "deterministic" | "llm" | "fallback";
  /** Native provider web search / grounding for current_information. */
  enableWebSearch: boolean;
  reason: string;
  matchedSignals: string[];
};
