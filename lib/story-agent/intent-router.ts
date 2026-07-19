import type { StoryOperation } from "@/lib/story-agent/operations";
import type { StoryMemory } from "@/lib/story-agent/schema";

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
  reason: string;
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
  /\bsuggest\s+(ideas?|options?|concepts?)\b/i,
  /\boptions?\s+do\b/i,
  /\btwist\s+batao\b/i,
  /\bconcept\s+suggest\b/i,
  /\bbrainstorm\b/i,
  /\b3\s+(unique\s+)?(story\s+)?concepts?\b/i,
  /\bsirf\s+options\s+do\b/i,
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

/**
 * Fast deterministic pre-router. High-confidence matches skip LLM classification.
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

  // Safety first
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

  if (anyMatch(WRITE_SCENE, text)) {
    return {
      operation: "write_scene",
      confidence: "high",
      skipClassifier: true,
      clearGenerationBlock: true,
      reason: "write_scene_pattern",
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

  if (anyMatch(REVISE, text)) {
    return {
      operation: "revise_draft",
      confidence: memory?.latestDraft?.content ? "high" : "medium",
      skipClassifier: Boolean(memory?.latestDraft?.content),
      reason: "revise_pattern",
    };
  }

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

  if (anyMatch(BRAINSTORM, text)) {
    return {
      operation: "brainstorm",
      confidence: "high",
      skipClassifier: true,
      reason: "brainstorm",
    };
  }

  if (anyMatch(MEMORY, text)) {
    return {
      operation: "memory_update",
      confidence: "high",
      skipClassifier: false, // still use structured agent for patch quality
      reason: "memory_pattern",
    };
  }

  if (/^(storytelling|story|idea|concept|help|hi|hello|hey)$/i.test(text)) {
    return {
      operation: "brainstorm",
      confidence: "high",
      skipClassifier: true,
      fixedReply:
        text.toLowerCase() === "storytelling" || text.toLowerCase() === "story"
          ? "Sure. Aap apna rough idea bata sakti ho—even one character, one scene, or just a feeling. Ya main aapke liye 3 unique story concepts suggest karun?"
          : undefined,
      reason: "ultra_short",
    };
  }

  return {
    operation: "conversational_chat",
    confidence: "low",
    skipClassifier: false,
    reason: "ambiguous",
  };
}
