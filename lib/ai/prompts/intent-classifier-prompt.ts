/**
 * Intent classifier prompt — classify only, never answer the user (Phase B).
 */

import type { IntentContext } from "@/lib/conversation-brain/intent-context";
import {
  INTENT_DEFINITIONS,
  STORY_INTENTS,
  type StoryIntent,
} from "@/lib/conversation-brain/intents";

const CLASSIFIER_INTENTS: StoryIntent[] = STORY_INTENTS.filter(
  (i) => i !== "offer_selection" && i !== "awaiting_answer"
);

export function buildIntentClassifierPrompt(params: {
  userMessage: string;
  context: IntentContext;
}): { system: string; prompt: string } {
  const defs = CLASSIFIER_INTENTS.map(
    (i) => `- ${i}: ${INTENT_DEFINITIONS[i]}`
  ).join("\n");

  const system = `You are an intent classifier for a storytelling assistant.
Classify the user message into exactly ONE allowed intent.
Never answer the user. Never write story prose.
Output valid JSON only.
If uncertain, use intent "unknown" with low confidence.
Do not invent character names not present in the message or context.
Distinguish corrections from updates, preference changes from prose requests, and draft revisions from new generation.

Allowed intents:
${defs}`;

  const ctx = params.context;
  const prompt = `USER MESSAGE:
${params.userMessage.slice(0, 500)}

INTENT CONTEXT (compact):
phase: ${ctx.conversationPhase}
generationBlocked: ${ctx.generationBlocked}
hasLatestDraft: ${ctx.hasLatestDraft}
hasLinkedStory: ${ctx.hasLinkedStory}
lastIntent: ${ctx.lastIntent || "none"}
awaiting: ${ctx.awaiting.type}/${ctx.awaiting.topic}
lastOffers: ${ctx.lastOfferLabels.join(" | ") || "none"}
recentQuestion: ${ctx.recentAssistantQuestion || "none"}
recentCharacters: ${ctx.recentCharacterNames.join(", ") || "none"}
knownCharacters: ${ctx.knownCharacterNames.join(", ") || "none"}
languagePreference: ${ctx.languagePreference}

Return JSON:
{
  "intent": "<one allowed intent>",
  "confidence": 0.0,
  "entities": {
    "characterNames": [],
    "episodeNumber": null,
    "requestedTone": null,
    "requestedLanguage": null
  },
  "reason": "short internal reason"
}`;

  return { system, prompt };
}
