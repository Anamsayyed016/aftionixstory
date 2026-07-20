import {
  detectLanguageInstruction,
  readLanguagePreferences,
} from "@/lib/story-agent/language-preferences";
import { isConceptCreateRequest } from "@/lib/story-agent/concept-reply";
import { looksLikeFreshSceneRequest } from "@/lib/story-agent/entity-resolver";
import { extractMemoryFacts } from "@/lib/story-agent/memory-facts";
import { detectStyleFeedback, readStyleProfile } from "@/lib/story-agent/style-profile";
import type { StoryOperation } from "@/lib/story-agent/operations";
import type { MemoryPatch, StoryMemory } from "@/lib/story-agent/schema";

export type IntentConfidence = "high" | "medium" | "low";

export type IntentRoute = {
  operation: StoryOperation;
  confidence: IntentConfidence;
  /** When true, skip LLM intent classification entirely. */
  skipClassifier: boolean;
  generationBlocked?: boolean;
  clearGenerationBlock?: boolean;
  /** Optional fixed reply (no model needed). */
  fixedReply?: string;
  /** Deterministic memory patch when intent is update_memory. */
  memoryPatch?: MemoryPatch;
  matchedSignals?: string[];
  reason: string;
  /** Language detection metadata for observability. */
  languageLabel?: string;
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
  /\bonly\s+suggest\b/i,
  /\bsirf\s+options\b/i,
  /\bwrite\s+mat\b/i,
  /\blikhna\s+mat\b/i,
  /\babhi\s+mat\s+likho\b/i,
];

const WRITE_SCENE = [
  /\bwrite\s+a\s+(short\s+)?(romantic\s+|horror\s+|fantasy\s+|dialogue\s+|love\s+)?scene\b/i,
  /\bshort\s+(romantic\s+)?scene\b/i,
  /\bromantic\s+scene\b/i,
  /\bhorror\s+scene\b/i,
  /\bfantasy\s+scene\b/i,
  /\bdialogue\s+scene\b/i,
  /\bek\s+scene\s+likh/i,
  /\bscene\s+(start\s+)?karo\b/i,
  /\bscene\s+likho\b/i,
  /\bwrite\s+\d{2,4}\s*(-|–|—|to)?\s*\d{0,4}\s*words?\b/i,
  /\bwrite\s+between\b.+\band\b/i,
  /\b\d{3,4}\s*[-–—]\s*\d{3,4}\s*words?\b/i,
  /\bscene\s+between\b/i,
  /\blikho\s+.*(scene|dialogue)\b/i,
  /\bbuild\s+(the\s+)?.+\b(kiss|scene|moment|argument|opening)\b/i,
  /\b(create|make)\s+(a\s+|an\s+)?(kiss|argument|opening)\s+scene\b/i,
  /\b(kiss|argument|fight|confession)\s+scene\b/i,
  /\baround\s+an?\s+(internal\s+)?conflict\b/i,
  /\bmake\s+their\s+\w+\s+emotionally\b/i,
];

const START_STORY = [
  /\bstart\s+(the\s+)?story\b/i,
  /\bstory\s+shuru\b/i,
  /\bstory\s+start\s+karo\b/i,
  /\bbegin\s+(writing|episode)\b/i,
  /\bepisode\s*1\b/i,
  /\bstart\s+episode\b/i,
  /\bab\s+likho\b/i,
  /\bab\s+story\s+likho\b/i,
  /\bstart\s+now\b/i,
  /\bchoose\s+everything\b.*\bstart\b/i,
  /\bfantasy\s+story\s+start\b/i,
];

const CONTINUE = [
  /\bnext\s+episode\b/i,
  /\bagla\s+episode\b/i,
  /\baage\s+likho\b/i,
  /\bcontinue\s+from\b/i,
  /\bcontinue\s+(the\s+)?(story|episode|draft)\b/i,
  /^continue\.?$/i,
];

const REVISE = [
  /\brewrite\b/i,
  /\brevise\b/i,
  /\bmake\s+(it\s+)?(slower|more\s+emotional|faster)\b/i,
  /\bslow\s+karo\b/i,
  /\bromance\s+add\b/i,
  /\bdialogue\s+improve\b/i,
  /\bdialogues?\s+natural\b/i,
  /\bnatural\s+karo\b/i,
  /\bmore\s+emotional\b/i,
  /\buppercase\b.*\bdialogue/i,
  /\bprevious\s+scene\b/i,
  /\bmake\s+the\s+previous\b/i,
];

const MEMORY = [
  /\bremember\s+this\b/i,
  /\byaad\s+rakh/i,
  /\bremove\s+\w+/i,
  /\bhata\s+do\b/i,
  /\b\w+\s+(innocent|childish|soft)\s+hai\b/i,
  /\b\w+\s+childish\s+nahi\b/i,
  /\b\w+\s+nahi\s+(hai|hain)\b/i,
  /\bfather\s+nahi\s+uncle\b/i,
  /\buncle\s+hai\b/i,
];

const BRAINSTORM = [
  /\bsuggest\s+(ideas?|options?|concepts?|something)\b/i,
  /\bsuggest\s+.+\b(unique|serialized|serial)\b/i,
  /\bunique\b.+\b(serialized|serial)\s+story\b/i,
  /\boptions?\s+do\b/i,
  /\btwist\s+batao\b/i,
  /\bconcept\s+suggest\b/i,
  /\bbrainstorm\b/i,
  /\b3\s+(unique\s+)?(story\s+)?concepts?\b/i,
  /\bsirf\s+options\s+do\b/i,
  /\bhelp\s+me\s+create\b/i,
  /\bcreate\s+a\b/i,
  /\bi\s+want\s+a\b/i,
  /\bmake\s+a\b.+\b(story|romance|thriller|horror|fantasy|drama)\b/i,
  /\bstory\s+about\b/i,
  /\bi\s+have\s+a\b.+\b(idea|concept|romance|thriller)\b/i,
];

const INSPECT = [
  /\bwhat\s+do\s+you\s+remember\b/i,
  /\bshow\s+(my\s+)?(story\s+)?(details|memory)\b/i,
  /\bstory\s+details\b/i,
  /\binspect\s+memory\b/i,
];

const CREATE = [/\bcreate\s+(the\s+)?story\b/i, /\bsave\s+(this\s+)?setup\b/i];
const SAVE = [/\bsave\s+(the\s+)?episode\b/i, /\bsave\s+draft\b/i];
const SUMMARIZE = [/\bsummarize\b/i, /\bsummary\s+do\b/i];

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

function hasDraft(memory?: StoryMemory | null): boolean {
  return Boolean(memory?.latestDraft?.content?.trim());
}

/**
 * Fast deterministic pre-router. High-confidence matches skip LLM classification.
 *
 * Priority:
 * 1. safety/control
 * 2. save/create
 * 3. language/style revision when latestDraft exists
 * 4. creative writing
 * 5. memory/preference (incl. language without draft)
 * 6. general conversation
 */
export function routeIntent(
  userMessage: string,
  memory?: StoryMemory | null
): IntentRoute {
  const text = userMessage.trim();
  if (!text) {
    return {
      operation: "conversational_chat",
      confidence: "high",
      skipClassifier: true,
      fixedReply: "Boliye — kya likhna ya plan karna hai?",
      reason: "empty",
    };
  }

  // 1. Safety first
  if (anyMatch(DO_NOT_START, text)) {
    const wantsOptions =
      anyMatch(BRAINSTORM, text) || /\boptions?\b/i.test(text);
    return {
      operation: wantsOptions ? "brainstorm" : "conversational_chat",
      confidence: "high",
      skipClassifier: true,
      generationBlocked: true,
      fixedReply: wantsOptions
        ? "Theek hai — abhi story start nahi karungi. Yeh 3 options soch sakti hoon: (1) forbidden college romance, (2) childhood friends reunion, (3) rivals-to-lovers. Kaunsa explore karein?"
        : "Theek hai — abhi story start nahi karungi. Concept build karte rahenge. Jab ready ho, “start the story” ya “write a scene” bol dena.",
      reason: "do_not_start",
    };
  }

  // 2. Explicit save / create
  if (anyMatch(SAVE, text)) {
    return {
      operation: "save_episode",
      confidence: "high",
      skipClassifier: true,
      reason: "save_episode",
    };
  }

  if (anyMatch(CREATE, text)) {
    return {
      operation: "create_story",
      confidence: "high",
      skipClassifier: true,
      reason: "create_story",
    };
  }

  const existingLang = readLanguagePreferences({
    narrationLanguage: memory?.userPreferences.narrationLanguage,
    dialogueLanguage: memory?.userPreferences.dialogueLanguage,
    scriptPreference: memory?.userPreferences.scriptPreference,
    mirrorUserLanguage: memory?.userPreferences.mirrorUserLanguage,
    storyLanguage: memory?.storyMemory.language,
  });
  const lang = detectLanguageInstruction(text, existingLang);

  const freshSceneRequest =
    looksLikeFreshSceneRequest(text) || anyMatch(WRITE_SCENE, text);

  // 3. Language / style revision when an unsaved draft exists
  // Fresh scene requests must NOT become revise_draft just because a draft exists
  if (
    !freshSceneRequest &&
    hasDraft(memory) &&
    (lang.matched || anyMatch(REVISE, text))
  ) {
    return {
      operation: "revise_draft",
      confidence: "high",
      skipClassifier: true,
      reason: lang.matched ? "language_revise_draft" : "revise_pattern",
      languageLabel: lang.matched ? lang.detectedLabel : undefined,
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

  if (hasDraft(memory) && style.matched && /shuddh|formal|simple\s+human|more\s+emotional|uppercase|fast\s+(chal|hai)/i.test(text)) {
    return {
      operation: "revise_draft",
      confidence: "high",
      skipClassifier: true,
      reason: "style_revise_draft",
    };
  }

  if (style.matched) {
    return {
      operation: "memory_update",
      confidence: "high",
      skipClassifier: true,
      fixedReply: style.confirmReply,
      reason: "style_preference_only",
    };
  }

  // 4. Creative writing commands
  if (freshSceneRequest) {
    return {
      operation: "write_scene",
      confidence: "high",
      skipClassifier: true,
      clearGenerationBlock: true,
      reason: looksLikeFreshSceneRequest(text)
        ? "fresh_scene_request"
        : "write_scene_pattern",
      languageLabel: lang.matched ? lang.detectedLabel : undefined,
    };
  }

  if (anyMatch(START_STORY, text)) {
    return {
      operation: "start_story",
      confidence: "high",
      skipClassifier: true,
      clearGenerationBlock: true,
      reason: "start_story_pattern",
    };
  }

  if (anyMatch(CONTINUE, text)) {
    return {
      operation: "continue_episode",
      confidence: "high",
      skipClassifier: true,
      clearGenerationBlock: true,
      reason: "continue_pattern",
    };
  }

  // 5. Language preference without draft — memory only, no generation
  if (lang.matched) {
    const dlg = lang.resolved.dialogueLanguage;
    const nar = lang.resolved.narrationLanguage;
    const desc =
      nar === dlg
        ? `${nar}`
        : `narration ${nar}, dialogues ${dlg}`;
    return {
      operation: "memory_update",
      confidence: "high",
      skipClassifier: true,
      fixedReply: `Theek hai — ab se writing ${desc} me rakhungi. Jab scene ya episode likhne bolo, isi language me likhungi.`,
      reason: "language_preference_only",
      languageLabel: lang.detectedLabel,
    };
  }

  if (anyMatch(REVISE, text)) {
    return {
      operation: "revise_draft",
      confidence: "medium",
      skipClassifier: false,
      reason: "revise_pattern_no_draft",
    };
  }

  if (anyMatch(INSPECT, text)) {
    return {
      operation: "show_story_details",
      confidence: "high",
      skipClassifier: true,
      reason: "inspect",
    };
  }

  if (anyMatch(SUMMARIZE, text)) {
    return {
      operation: "summarize",
      confidence: "medium",
      skipClassifier: false,
      reason: "summarize",
    };
  }

  // Explicit story facts / corrections — before brainstorm so "Azar male lead"
  // never becomes a concept-generation failure.
  const memoryFacts = extractMemoryFacts(text, memory);
  if (memoryFacts.matched) {
    return {
      operation: "memory_update",
      confidence: memoryFacts.confidence,
      skipClassifier: true,
      fixedReply: memoryFacts.confirmReply,
      memoryPatch: memoryFacts.patch,
      matchedSignals: memoryFacts.matchedSignals,
      reason: "memory_facts",
    };
  }

  if (anyMatch(BRAINSTORM, text) || isConceptCreateRequest(text)) {
    return {
      operation: "brainstorm",
      confidence: "high",
      skipClassifier: true,
      reason: isConceptCreateRequest(text)
        ? "concept_create_request"
        : "brainstorm",
    };
  }

  if (anyMatch(MEMORY, text)) {
    return {
      operation: "memory_update",
      confidence: "high",
      skipClassifier: false,
      reason: "memory_pattern",
    };
  }

  if (
    /^(storytelling|story|idea|concept|help|hi|hello|hey|hola)$/i.test(text) ||
    /^(kaise\s+ho|kya\s+haal|namaste|good\s+morning|good\s+evening)[!?.]*$/i.test(
      text
    )
  ) {
    const lower = text.toLowerCase().replace(/[!?.]+$/, "").trim();
    const greetingReplies: Record<string, string> = {
      hey: "Hey! 😊 Apna rough story idea batao—ek character, scene, ya sirf ek feeling bhi chalegi.",
      hi: "Hi! ✨ Kya likhna hai aaj—nayi story, scene, ya pehle se idea polish karna?",
      hello: "Hello! 🤍 Story idea share karo, ya main 3 unique concepts suggest karun?",
      help: "Bilkul! 😊 Aap idea bata sakte ho, characters add kar sakte ho, ya “write a scene” bol ke draft maang sakte ho.",
      hola: "Hola! ✨ Apna story vibe batao—romance, thriller, fantasy, kuch bhi.",
      namaste: "Namaste! 🤍 Aapki story ka rough idea sunna chahti hoon.",
      "kaise ho": "Main theek hoon! 😊 Aap batao—aaj kya create karna hai?",
      "kya haal": "Sab theek! ✨ Story pe kaam karein? Idea ya scene se start kar sakte hain.",
      "good morning": "Good morning! ✨ Aaj kaunsi story pe focus karna hai?",
      "good evening": "Good evening! 🤍 Idea, scene, ya revise—batao kya chahiye.",
      storytelling:
        "Sure. Aap apna rough idea bata sakti ho—even one character, one scene, or just a feeling. Ya main aapke liye 3 unique story concepts suggest karun? ✨",
      story:
        "Sure. Aap apna rough idea bata sakti ho—even one character, one scene, or just a feeling. Ya main aapke liye 3 unique story concepts suggest karun? ✨",
      idea: "Nice—idea share karo, main usse expand karungi. 😊",
      concept: "Concept sunao—main usko scenes aur characters me shape kar sakti hoon. ✨",
    };

    return {
      operation: "conversational_chat",
      confidence: "high",
      skipClassifier: true,
      fixedReply:
        greetingReplies[lower] ||
        "Hey! 😊 Apna rough story idea batao—ek character, scene, ya sirf ek feeling bhi chalegi.",
      reason: "greeting_or_help",
    };
  }

  return {
    operation: "conversational_chat",
    confidence: "low",
    skipClassifier: false,
    reason: "ambiguous",
  };
}
