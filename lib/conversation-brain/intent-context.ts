/**
 * Compact IntentContext for routing (Phase B).
 * Never dump full memory / drafts into the classifier.
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import type { StoryMemory } from "@/lib/story-agent/schema";

export type IntentContext = {
  conversationPhase: ConversationFlow["phase"];
  generationBlocked: boolean;
  hasLatestDraft: boolean;
  hasLinkedStory: boolean;
  lastIntent: string;
  awaiting: ConversationFlow["awaiting"];
  lastOfferLabels: string[];
  recentAssistantQuestion: string | null;
  recentCharacterNames: string[];
  knownCharacterNames: string[];
  knownEpisodeCount: number;
  languagePreference: string;
};

export function buildIntentContext(params: {
  memory: StoryMemory;
  flow?: ConversationFlow | null;
  storyId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
}): IntentContext {
  const flow = params.flow ?? DEFAULT_CONVERSATION_FLOW;
  const draft = Boolean(params.memory.latestDraft?.content?.trim());
  const knownCharacterNames = params.memory.characters
    .map((c) => c.name)
    .filter(Boolean)
    .slice(0, 12);

  const recent = params.recentMessages ?? [];
  const recentAssistant = [...recent]
    .reverse()
    .find((m) => m.role === "assistant");
  const recentAssistantQuestion =
    recentAssistant && /\?/.test(recentAssistant.content)
      ? recentAssistant.content.split("?").slice(0, 2).join("?").slice(0, 180)
      : null;

  const recentCharacterNames: string[] = [];
  const haystack = recent
    .slice(-6)
    .map((m) => m.content)
    .join("\n");
  for (const name of knownCharacterNames) {
    if (new RegExp(`\\b${escapeRe(name)}\\b`, "i").test(haystack)) {
      recentCharacterNames.push(name);
    }
  }

  const lang =
    params.memory.userPreferences.dialogueLanguage ||
    params.memory.userPreferences.narrationLanguage ||
    params.memory.storyMemory.language ||
    "hinglish";

  return {
    conversationPhase: flow.phase,
    generationBlocked: Boolean(
      flow.generationBlocked || params.memory.userPreferences.doNotStartYet
    ),
    hasLatestDraft: draft,
    hasLinkedStory: Boolean(params.storyId),
    lastIntent: flow.lastIntent || "",
    awaiting: flow.awaiting,
    lastOfferLabels: flow.lastOffers.map((o) => o.label).slice(0, 4),
    recentAssistantQuestion,
    recentCharacterNames: recentCharacterNames.slice(0, 6),
    knownCharacterNames,
    knownEpisodeCount: 0,
    languagePreference: String(lang).toLowerCase(),
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
