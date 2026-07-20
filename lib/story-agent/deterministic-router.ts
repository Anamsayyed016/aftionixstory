/**
 * Deterministic turn router — handles greetings, controls, preferences, and
 * memory facts without calling OpenAI/Gemini.
 */

import {
  detectLanguageInstruction,
  languagePrefsToStoryLanguageLabel,
  readLanguagePreferences,
} from "@/lib/story-agent/language-preferences";
import {
  detectStyleFeedback,
  readStyleProfile,
} from "@/lib/story-agent/style-profile";
import {
  parseDeterministicMemory,
  type DeterministicParseResult,
} from "@/lib/story-agent/deterministic-memory-parser";
import {
  doNotStartReply,
  greetingReply,
  languagePreferenceReply,
  memoryConfirmReply,
  preferenceConfirmReply,
} from "@/lib/story-agent/deterministic-replies";
import type { StoryOperation } from "@/lib/story-agent/operations";
import type { MemoryPatch, StoryMemory } from "@/lib/story-agent/schema";

export type DeterministicIntent =
  | "greeting"
  | "do_not_start"
  | "update_preference"
  | "update_memory"
  | "correct_memory"
  | "none";

export type DeterministicTurn = {
  handled: boolean;
  aiRequired: false;
  intent: DeterministicIntent;
  operation: StoryOperation;
  confidence: "high" | "medium";
  matchedSignals: string[];
  assistantReply: string;
  memoryPatch?: MemoryPatch;
  generationBlocked?: boolean;
  parse?: DeterministicParseResult;
};

const DO_NOT_START = [
  /\bstory\s+start\s+mat\b/i,
  /\bstart\s+mat\s+kar/i,
  /\babhi\s+start\s+nahi\b/i,
  /\babhi\s+mat\s+likh/i,
  /\bdon['’]?t\s+start\b/i,
  /\bdo\s+not\s+start\b/i,
  /\bonly\s+concept\b/i,
  /\bsirf\s+discuss\b/i,
  /\bonly\s+discuss\b/i,
  /\babhi\s+sirf\s+concept\b/i,
  /\bconcept\s+build\s+karo\b/i,
];

const GREETING_RE =
  /^(hey|hi|hello|hola|salam|assalamualaikum|help|namaste|kaise\s+ho|kya\s+haal|good\s+morning|good\s+evening)[!?.]*$/i;

function emptyUnhandled(): DeterministicTurn {
  return {
    handled: false,
    aiRequired: false,
    intent: "none",
    operation: "conversational_chat",
    confidence: "medium",
    matchedSignals: [],
    assistantReply: "",
  };
}

/**
 * Try to fully resolve a turn without any AI provider call.
 */
export function tryDeterministicTurn(
  userMessage: string,
  memory?: StoryMemory | null
): DeterministicTurn {
  const text = userMessage.trim();
  if (!text) {
    return {
      handled: true,
      aiRequired: false,
      intent: "greeting",
      operation: "conversational_chat",
      confidence: "high",
      matchedSignals: ["empty"],
      assistantReply: "Boliye — kya likhna ya plan karna hai?",
    };
  }

  if (DO_NOT_START.some((re) => re.test(text))) {
    const wantsOptions = /\boptions?\b|\bconcept\b|\bsuggest\b/i.test(text);
    return {
      handled: true,
      aiRequired: false,
      intent: "do_not_start",
      operation: wantsOptions ? "brainstorm" : "conversational_chat",
      confidence: "high",
      matchedSignals: ["do_not_start"],
      assistantReply: doNotStartReply(wantsOptions),
      generationBlocked: true,
      memoryPatch: {
        story: {},
        characters: [],
        relationships: [],
        writingRules: [],
        preferences: { doNotStartYet: true },
        remove: [],
      },
    };
  }

  if (GREETING_RE.test(text)) {
    const key = text.toLowerCase().replace(/[!?.]+$/g, "").trim();
    const reply = greetingReply(key);
    if (reply) {
      return {
        handled: true,
        aiRequired: false,
        intent: "greeting",
        operation: "conversational_chat",
        confidence: "high",
        matchedSignals: ["greeting"],
        assistantReply: reply,
      };
    }
  }

  const existingLang = readLanguagePreferences({
    narrationLanguage: memory?.userPreferences.narrationLanguage,
    dialogueLanguage: memory?.userPreferences.dialogueLanguage,
    scriptPreference: memory?.userPreferences.scriptPreference,
    mirrorUserLanguage: memory?.userPreferences.mirrorUserLanguage,
    storyLanguage: memory?.storyMemory.language,
  });
  const lang = detectLanguageInstruction(text, existingLang);
  if (lang.matched) {
    const dlg = lang.resolved.dialogueLanguage;
    const nar = lang.resolved.narrationLanguage;
    const desc =
      nar === dlg ? `${nar}` : `narration ${nar}, dialogues ${dlg}`;
    return {
      handled: true,
      aiRequired: false,
      intent: "update_preference",
      operation: "memory_update",
      confidence: "high",
      matchedSignals: ["language_preference", lang.detectedLabel],
      assistantReply: languagePreferenceReply(desc),
      memoryPatch: {
        story: {
          language: languagePrefsToStoryLanguageLabel(lang.resolved),
        },
        characters: [],
        relationships: [],
        writingRules: [],
        preferences: {
          narrationLanguage: lang.patch.narrationLanguage,
          dialogueLanguage: lang.patch.dialogueLanguage,
          scriptPreference: lang.patch.scriptPreference,
          mirrorUserLanguage: lang.patch.mirrorUserLanguage,
        },
        remove: [],
      },
    };
  }

  const style = detectStyleFeedback(
    text,
    readStyleProfile({
      formality: memory?.userPreferences.formality,
      emojiStyle: memory?.userPreferences.emojiStyle,
      avoidFormalHindi: memory?.userPreferences.avoidFormalHindi,
      preferShortDialogues: memory?.userPreferences.preferShortDialogues,
      pacingHint: memory?.userPreferences.pacingHint,
      avoid: memory?.userPreferences.avoid,
      uppercaseForLoudDialogue:
        memory?.userPreferences.uppercaseForLoudDialogue,
      episodeLength: memory?.userPreferences.episodeLength,
    })
  );
  if (style.matched && style.confirmReply) {
    return {
      handled: true,
      aiRequired: false,
      intent: "update_preference",
      operation: "memory_update",
      confidence: "high",
      matchedSignals: ["style_preference", style.label || "style"],
      assistantReply:
        style.confirmReply || preferenceConfirmReply(style.label || "style"),
      memoryPatch: {
        story: {},
        characters: [],
        relationships: [],
        writingRules: style.writingRules.map((rule) => ({
          rule,
          priority: "important" as const,
        })),
        preferences: style.patch as MemoryPatch["preferences"],
        remove: [],
      },
    };
  }

  const parsed = parseDeterministicMemory(text, memory);
  if (parsed.matched) {
    const intent: DeterministicIntent =
      parsed.kind === "relationship" &&
      parsed.matchedSignals.some((s) => s.includes("correction"))
        ? "correct_memory"
        : "update_memory";
    return {
      handled: true,
      aiRequired: false,
      intent,
      operation: "memory_update",
      confidence: parsed.confidence,
      matchedSignals: parsed.matchedSignals,
      assistantReply: memoryConfirmReply(parsed),
      memoryPatch: parsed.patch,
      parse: parsed,
    };
  }

  return emptyUnhandled();
}

export function requiresAiProvider(operation: StoryOperation): boolean {
  return (
    operation === "brainstorm" ||
    operation === "suggest_options" ||
    operation === "conversational_chat" ||
    operation === "write_scene" ||
    operation === "start_story" ||
    operation === "generate_episode" ||
    operation === "continue_episode" ||
    operation === "revise_draft" ||
    operation === "summarize"
  );
}
