/**
 * Context-aware intent scoring (Phase B) — draft/story state sensitive.
 */

import type { IntentContext } from "@/lib/conversation-brain/intent-context";
import type { IntentRouteResult } from "@/lib/conversation-brain/intents";
import { isCreativeStoryIntent } from "@/lib/conversation-brain/intents";
import {
  toRouteResultFromMatch,
  type IntentRuleMatch,
} from "@/lib/conversation-brain/intent-rules";

/**
 * Soft contextual matches (0.55–0.85). May trigger LLM if below threshold.
 */
export function scoreContextualIntent(
  userMessage: string,
  ctx: IntentContext
): IntentRouteResult | null {
  const text = userMessage.trim();
  if (!text) return null;

  // "Make it different" / ambiguous revise
  if (/\bmake\s+it\s+(different|better|new)\b/i.test(text)) {
    if (ctx.hasLatestDraft) {
      return fromMatch(
        {
          intent: "revise_style",
          confidence: 0.72,
          signals: ["contextual_revise_ambiguous"],
          needsDraft: true,
        },
        "contextual"
      );
    }
    return fromMatch(
      {
        intent: "unknown",
        confidence: 0.45,
        signals: ["contextual_ambiguous_no_draft"],
        needsClarification: true,
        clarificationReason: "ambiguous_without_draft",
      },
      "contextual"
    );
  }

  // Trait update: "Anaya is innocent and strong"
  if (
    /\b([A-Z][a-z]{2,20})\s+is\s+\w+/i.test(text) &&
    !/\b(not|nahi)\b/i.test(text) &&
    text.length < 120
  ) {
    const m = text.match(/\b([A-Z][a-z]{2,20})\b/);
    return fromMatch(
      {
        intent: "update_character",
        confidence: 0.78,
        signals: ["contextual_character_trait"],
        entities: { characterNames: m ? [m[1]] : [] },
      },
      "contextual"
    );
  }

  // Who is she? — use recent characters
  if (/^who\s+is\s+she\??$/i.test(text) && ctx.recentCharacterNames.length) {
    return fromMatch(
      {
        intent: "character_question",
        confidence: 0.7,
        signals: ["contextual_who_is_she"],
        entities: { characterNames: [ctx.recentCharacterNames[0]] },
      },
      "contextual"
    );
  }

  // Romantic preference without draft
  if (/\bmore\s+romantic\b|\bromance\s+add\b/i.test(text)) {
    if (ctx.hasLatestDraft) {
      return fromMatch(
        {
          intent: "make_romantic",
          confidence: 0.8,
          signals: ["contextual_romantic_draft"],
          needsDraft: true,
        },
        "contextual"
      );
    }
    return fromMatch(
      {
        intent: "tone_change",
        confidence: 0.75,
        signals: ["contextual_romantic_pref"],
        entities: { requestedTone: "romantic" },
      },
      "contextual"
    );
  }

  // Funny
  if (/\bmore\s+funny\b|\bcomedy\s+add\b|\bmake\s+it\s+funny\b/i.test(text)) {
    if (ctx.hasLatestDraft) {
      return fromMatch(
        {
          intent: "make_funny",
          confidence: 0.8,
          signals: ["contextual_funny_draft"],
          needsDraft: true,
        },
        "contextual"
      );
    }
  }

  // Expand
  if (/^(expand|longer|aur\s+lamba)[.!]?$/i.test(text)) {
    if (ctx.hasLatestDraft) {
      return fromMatch(
        {
          intent: "expand",
          confidence: 0.82,
          signals: ["contextual_expand"],
          needsDraft: true,
        },
        "contextual"
      );
    }
    return fromMatch(
      {
        intent: "normal_chat",
        confidence: 0.7,
        signals: ["expand_no_draft"],
        needsClarification: true,
        clarificationReason: "no_draft_to_expand",
      },
      "contextual"
    );
  }

  return null;
}

function fromMatch(
  match: IntentRuleMatch,
  source: IntentRouteResult["source"]
): IntentRouteResult {
  const result = toRouteResultFromMatch(match, source);
  // Soft contextual: don't force aiRequired for clarifications
  if (match.needsClarification) {
    return { ...result, aiRequired: false, creativeGeneration: false };
  }
  if (isCreativeStoryIntent(match.intent)) {
    return { ...result, aiRequired: true, creativeGeneration: true };
  }
  return result;
}
