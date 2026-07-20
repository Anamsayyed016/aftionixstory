/**
 * Post-classification validation & safety overrides (Phase B).
 */

import type { IntentContext } from "@/lib/conversation-brain/intent-context";
import type { IntentRouteResult } from "@/lib/conversation-brain/intents";
import { isCreativeStoryIntent } from "@/lib/conversation-brain/intents";

/**
 * Apply state-aware overrides. Never lets classifier bypass generationBlocked.
 */
export function applyIntentOverrides(
  result: IntentRouteResult,
  ctx: IntentContext
): IntentRouteResult {
  const next = { ...result, entities: { ...result.entities } };

  // Hard stop: creative while blocked
  if (ctx.generationBlocked && isCreativeStoryIntent(next.intent)) {
    return {
      ...next,
      intent: "block_generation",
      confidence: Math.max(next.confidence, 0.95),
      source: next.source === "llm" ? "llm" : next.source,
      aiRequired: false,
      creativeGeneration: false,
      needsClarification: false,
      clarificationReason: null,
      matchedSignals: [...next.matchedSignals, "override_blocked_creative"],
      overrideReason: "generation_blocked",
    };
  }

  // Rewrite family without draft → clarification / tone
  const reviseFamily = new Set([
    "rewrite",
    "revise_tone",
    "revise_style",
    "make_emotional",
    "make_romantic",
    "make_funny",
    "shorten",
    "expand",
  ]);
  if (reviseFamily.has(next.intent) && !ctx.hasLatestDraft) {
    if (next.intent === "make_emotional" || next.intent === "make_romantic") {
      return {
        ...next,
        intent: "tone_change",
        creativeGeneration: false,
        needsDraft: false,
        aiRequired: false,
        matchedSignals: [...next.matchedSignals, "override_tone_pref"],
        overrideReason: "no_draft_tone_pref",
      };
    }
    return {
      ...next,
      intent: "normal_chat",
      aiRequired: false,
      creativeGeneration: false,
      needsDraft: false,
      needsClarification: true,
      clarificationReason: "no_draft_for_revision",
      matchedSignals: [...next.matchedSignals, "override_no_draft"],
      overrideReason: "no_draft_for_revision",
    };
  }

  // Episode question without story → clarification
  if (
    (next.intent === "episode_question" || next.intent === "summarize_episode") &&
    !ctx.hasLinkedStory &&
    !ctx.hasLatestDraft
  ) {
    return {
      ...next,
      intent: "normal_chat",
      aiRequired: false,
      needsStorySearch: false,
      needsClarification: true,
      clarificationReason: "no_story_for_episode_question",
      matchedSignals: [...next.matchedSignals, "override_no_story"],
      overrideReason: "no_story_for_episode_question",
    };
  }

  // Ambiguous delete
  if (next.intent === "memory_delete" && next.entities.characterNames.length === 0) {
    return {
      ...next,
      aiRequired: false,
      needsClarification: true,
      clarificationReason: "memory_delete_no_target",
      matchedSignals: [...next.matchedSignals, "override_delete_ambiguous"],
      overrideReason: "memory_delete_no_target",
    };
  }

  // Unknown / very low confidence → normal_chat (keep clarification if already set)
  if (next.intent === "unknown" || next.confidence < 0.4) {
    const keepClarify = Boolean(next.needsClarification && next.clarificationReason);
    return {
      ...next,
      intent: "normal_chat",
      confidence: Math.max(next.confidence, 0.5),
      source: next.source === "llm" ? "fallback" : next.source === "contextual" ? "contextual" : "fallback",
      aiRequired: !keepClarify,
      creativeGeneration: false,
      needsClarification: keepClarify,
      clarificationReason: keepClarify ? next.clarificationReason : null,
      matchedSignals: [...next.matchedSignals, "fallback_normal_chat"],
      overrideReason: "low_confidence_unknown",
    };
  }

  return next;
}
