/**
 * Composable deterministic intent rules (Phase B).
 * High-confidence only — LLM must never override these when matched.
 */

import type { IntentContext } from "@/lib/conversation-brain/intent-context";
import type {
  IntentEntities,
  IntentRouteResult,
  StoryIntent,
} from "@/lib/conversation-brain/intents";
import { isCreativeStoryIntent } from "@/lib/conversation-brain/intents";
import { isValidCanonicalEntityName } from "@/lib/story-agent/entity-guards";

export type IntentRuleMatch = {
  intent: StoryIntent;
  confidence: number;
  signals: string[];
  entities?: Partial<IntentEntities>;
  needsClarification?: boolean;
  clarificationReason?: string | null;
  needsDraft?: boolean;
};

type Rule = {
  id: string;
  priority: number;
  match: (text: string, ctx: IntentContext) => IntentRuleMatch | null;
};

function base(
  intent: StoryIntent,
  confidence: number,
  signals: string[],
  extras?: Partial<IntentRuleMatch>
): IntentRuleMatch {
  return {
    intent,
    confidence,
    signals,
    needsDraft: extras?.needsDraft ?? false,
    needsClarification: extras?.needsClarification ?? false,
    clarificationReason: extras?.clarificationReason ?? null,
    entities: extras?.entities,
  };
}

const RULES: Rule[] = [
  {
    id: "greeting",
    priority: 10,
    match: (text) => {
      if (
        /^(hey|hi|hello|hola|salam|assalamualaikum|namaste|kaise\s+ho|kya\s+haal|good\s+morning|good\s+evening)[!?.]*$/i.test(
          text
        )
      ) {
        return base("greeting", 0.99, ["greeting"]);
      }
      return null;
    },
  },
  {
    id: "unblock",
    priority: 20,
    match: (text, ctx) => {
      if (
        ctx.generationBlocked &&
        /\b(start\s+now|story\s+shuru(\s+karo)?|ab\s+likho|begin(\s+writing)?|start\s+the\s+story|ab\s+start\s+karo)\b/i.test(
          text
        )
      ) {
        return base("unblock_generation", 0.98, ["unblock_generation"]);
      }
      return null;
    },
  },
  {
    id: "block",
    priority: 25,
    match: (text) => {
      if (
        /\bstory\s+start\s+mat\b|\bstart\s+mat\s+kar|\babhi\s+start\s+nahi\b|\babhi\s+mat\s+likh|\bdon['’]?t\s+start\b|\bdo\s+not\s+start\b|\bonly\s+concept\b|\bsirf\s+discuss\b|\bonly\s+discuss\b|\babhi\s+sirf\s+concept\b|\bconcept\s+build\s+karo\b/i.test(
          text
        )
      ) {
        return base("block_generation", 0.98, ["block_generation"]);
      }
      return null;
    },
  },
  {
    id: "blocked_write",
    priority: 28,
    match: (text, ctx) => {
      if (
        ctx.generationBlocked &&
        /\b(write\s+a\s+(short\s+)?scene|write\s+the\s+scene|start\s+the\s+story|generate\s+(an?\s+)?episode|scene\s+likho|story\s+likho)\b/i.test(
          text
        )
      ) {
        return base("block_generation", 0.97, [
          "generation_blocked",
          "explicit_write",
        ]);
      }
      return null;
    },
  },
  {
    id: "language",
    priority: 40,
    match: (text) => {
      if (
        /^(hinglish|hindi|english|urdu|roman(?:ized)?\s*hindi)(?:\s+please)?[.!?]*$/i.test(
          text.trim()
        ) ||
        /\bhinglish\s+(me|mein)\b|\bhindi\s+(me|mein)\b|\benglish\s+(me|mein)\b|\blikho\s+hinglish\b|\blanguage\s+change\b|\bwrite\s+in\s+(hinglish|hindi|english)\b/i.test(
          text
        )
      ) {
        const lang = /\bhinglish\b/i.test(text)
          ? "hinglish"
          : /\bhindi\b|roman(?:ized)?\s*hindi/i.test(text)
            ? "hindi"
            : /\burdu\b/i.test(text)
              ? "urdu"
              : /\benglish\b/i.test(text)
                ? "english"
                : null;
        return base("language_change", 0.97, ["language_change"], {
          entities: { requestedLanguage: lang },
        });
      }
      return null;
    },
  },
  {
    id: "correction",
    priority: 45,
    match: (text) => {
      if (
        /\b(nahi|actually|correction|not\s+his|not\s+her|is\s+not)\b/i.test(
          text
        ) &&
        /\b(sister|brother|father|mother|uncle|daughter|son|wife|husband)\b/i.test(
          text
        )
      ) {
        const names = extractLikelyNames(text);
        return base("memory_correction", 0.94, ["memory_correction"], {
          entities: { characterNames: names },
        });
      }
      if (
        /\b([A-Za-z][A-Za-z'-]+)\s+(father|mother|uncle|sister|brother)\s+nahi\s+(uncle|aunt|father|mother|daughter|son)\b/i.test(
          text
        )
      ) {
        return base("memory_correction", 0.96, ["memory_correction_pattern"]);
      }
      return null;
    },
  },
  {
    id: "continue",
    priority: 50,
    match: (text, ctx) => {
      if (
        /^(continue|next|aage)[.!]?$/i.test(text) ||
        /\b(continue\s+(the\s+)?(story|scene|draft)|next\s+episode|aage\s+likho|story\s+continue\s+karo|agla\s+episode)\b/i.test(
          text
        )
      ) {
        if (ctx.hasLatestDraft || ctx.hasLinkedStory) {
          return base("continue_story", 0.95, ["continue"], {
            needsDraft: ctx.hasLatestDraft,
          });
        }
        return base("normal_chat", 0.9, ["continue_no_context"], {
          needsClarification: true,
          clarificationReason: "nothing_to_continue",
        });
      }
      return null;
    },
  },
  {
    id: "rewrite",
    priority: 55,
    match: (text, ctx) => {
      if (
        /\b(rewrite|dobara\s+likho|fir\s+se\s+likho|improve\s+this|make\s+it\s+better|revise)\b/i.test(
          text
        )
      ) {
        if (ctx.hasLatestDraft) {
          return base("rewrite", 0.94, ["rewrite"], { needsDraft: true });
        }
        return base("normal_chat", 0.85, ["rewrite_no_draft"], {
          needsClarification: true,
          clarificationReason: "no_draft_to_rewrite",
        });
      }
      return null;
    },
  },
  {
    id: "make_emotional",
    priority: 56,
    match: (text, ctx) => {
      if (
        /\b(more\s+emotional|aur\s+emotional|heart-?touching\s+banao|emotional\s+karo)\b/i.test(
          text
        )
      ) {
        if (ctx.hasLatestDraft) {
          return base("make_emotional", 0.95, ["make_emotional"], {
            needsDraft: true,
            entities: { requestedTone: "emotional" },
          });
        }
        return base("tone_change", 0.9, ["tone_change_emotional"], {
          entities: { requestedTone: "emotional" },
        });
      }
      return null;
    },
  },
  {
    id: "shorten",
    priority: 57,
    match: (text, ctx) => {
      if (/^(shorter|short\s+karo|chhota\s+karo)[.!]?$/i.test(text)) {
        if (ctx.hasLatestDraft) {
          return base("shorten", 0.94, ["shorten"], { needsDraft: true });
        }
        return base("normal_chat", 0.88, ["shorten_no_draft"], {
          needsClarification: true,
          clarificationReason: "no_draft_to_shorten",
        });
      }
      return null;
    },
  },
  {
    id: "write_scene",
    priority: 60,
    match: (text) => {
      if (
        /\b(write\s+a\s+(short\s+)?scene|scene\s+likho|ek\s+scene\s+likh)\b/i.test(
          text
        )
      ) {
        return base("write_scene", 0.95, ["write_scene"]);
      }
      return null;
    },
  },
  {
    id: "write_episode",
    priority: 61,
    match: (text) => {
      if (
        /\b(write\s+(the\s+)?next\s+episode|next\s+episode\s+likho|generate\s+episode|start\s+the\s+story|episode\s*1)\b/i.test(
          text
        )
      ) {
        return base("write_episode", 0.94, ["write_episode"]);
      }
      return null;
    },
  },
  {
    id: "generate_twist",
    priority: 65,
    match: (text) => {
      if (
        /\b(three\s+twists|3\s+twists|give\s+me\s+(three\s+)?twists|unique\s+twists|twist\s+batao)\b/i.test(
          text
        )
      ) {
        return base("generate_twist", 0.93, ["generate_twist"]);
      }
      return null;
    },
  },
  {
    id: "world_building",
    priority: 66,
    match: (text) => {
      if (
        /\b(create\s+a\s+.+\sworld|dark\s+royal\s+world|world\s+build|setting\s+banao)\b/i.test(
          text
        )
      ) {
        return base("world_building", 0.9, ["world_building"]);
      }
      return null;
    },
  },
  {
    id: "episode_question",
    priority: 70,
    match: (text) => {
      const ep = text.match(
        /\b(?:episode|ep)\s*#?\s*(\d+)\b|\bwhat\s+happened\s+in\s+episode\s*(\d+)/i
      );
      if (
        ep ||
        /\b(episode\s+me\s+kya\s+hua|previous\s+episode|last\s+episode)\b/i.test(
          text
        )
      ) {
        const n = ep
          ? Number(ep[1] || ep[2])
          : null;
        return base("episode_question", 0.92, ["episode_question"], {
          entities: { episodeNumber: Number.isFinite(n) ? n : null },
          needsClarification: false,
        });
      }
      return null;
    },
  },
  {
    id: "character_question",
    priority: 71,
    match: (text, ctx) => {
      const who = text.match(/\bwho\s+is\s+([A-Za-z][A-Za-z'-]{1,30})\b/i);
      if (who) {
        const name = who[1];
        const known = ctx.knownCharacterNames.some(
          (n) => n.toLowerCase() === name.toLowerCase()
        );
        return base("character_question", known ? 0.93 : 0.8, [
          "character_question",
        ], {
          entities: { characterNames: [name] },
        });
      }
      if (/\bcharacter\s+ke\s+baare\s+me\b|\btell\s+me\s+about\s+[A-Z]/i.test(text)) {
        return base("character_question", 0.85, ["character_question"]);
      }
      return null;
    },
  },
  {
    id: "story_question",
    priority: 72,
    match: (text) => {
      if (
        /\bwhat\s+happened\b|\bkya\s+hua\b|\bwhen\s+did\b|\bwhy\s+did\b/i.test(
          text
        )
      ) {
        return base("story_question", 0.82, ["story_question"]);
      }
      return null;
    },
  },
  {
    id: "help",
    priority: 80,
    match: (text) => {
      if (/^help[!?.]*$/i.test(text) || /\bhow\s+(do|can)\s+i\b/i.test(text)) {
        return base("help", 0.9, ["help"]);
      }
      return null;
    },
  },
  {
    id: "general_question",
    priority: 85,
    match: (text) => {
      if (
        /\bwhat\s+is\s+foreshadowing\b|\bwhat\s+is\s+a\s+protagonist\b|\bdefine\b/i.test(
          text
        )
      ) {
        return base("general_question", 0.88, ["general_question"]);
      }
      return null;
    },
  },
];

function extractLikelyNames(text: string): string[] {
  const names: string[] = [];
  const re = /\b([A-Z][a-z]{2,20})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (isValidCanonicalEntityName(m[1])) names.push(m[1]);
  }
  return [...new Set(names)].slice(0, 4);
}

/** Run deterministic rules; returns highest-priority match above threshold. */
export function matchDeterministicIntent(
  userMessage: string,
  ctx: IntentContext
): IntentRuleMatch | null {
  const text = userMessage.trim();
  if (!text) {
    return base("greeting", 0.99, ["empty"]);
  }

  const sorted = [...RULES].sort((a, b) => a.priority - b.priority);
  let best: IntentRuleMatch | null = null;
  let bestPriority = Infinity;
  for (const rule of sorted) {
    const hit = rule.match(text, ctx);
    if (!hit) continue;
    if (hit.confidence < 0.8) continue;
    if (rule.priority < bestPriority) {
      best = { ...hit, signals: [...hit.signals, rule.id] };
      bestPriority = rule.priority;
    }
  }
  return best;
}

export function toRouteResultFromMatch(
  match: IntentRuleMatch,
  source: IntentRouteResult["source"]
): IntentRouteResult {
  return {
    intent: match.intent,
    confidence: match.confidence,
    source,
    aiRequired:
      !match.needsClarification &&
      match.intent !== "greeting" &&
      match.intent !== "block_generation" &&
      match.intent !== "unblock_generation" &&
      match.intent !== "language_change" &&
      match.intent !== "memory_correction" &&
      (isCreativeStoryIntent(match.intent) ||
        match.intent === "brainstorm" ||
        match.intent === "story_question" ||
        match.intent === "character_question" ||
        match.intent === "episode_question" ||
        match.intent === "general_question" ||
        match.intent === "normal_chat" ||
        match.intent === "help"),
    creativeGeneration: isCreativeStoryIntent(match.intent),
    needsMemory: true,
    needsDraft: Boolean(match.needsDraft),
    needsStorySearch:
      match.intent === "search_story" ||
      match.intent === "episode_question" ||
      match.intent === "story_question",
    needsClarification: Boolean(match.needsClarification),
    clarificationReason: match.clarificationReason ?? null,
    matchedSignals: match.signals,
    entities: {
      characterNames: match.entities?.characterNames ?? [],
      episodeNumber: match.entities?.episodeNumber ?? null,
      requestedTone: match.entities?.requestedTone ?? null,
      requestedLanguage: match.entities?.requestedLanguage ?? null,
    },
  };
}
