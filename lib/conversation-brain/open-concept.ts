/**
 * Open-concept / collaborative brainstorm detection (Phase A).
 * Routes incomplete story ideas to collaborative chat — never wizard extraction.
 */

import { extractStoryConcept, isConceptCreateRequest } from "@/lib/story-agent/concept-reply";

export type OpenConceptKind =
  | "genre_desire"
  | "help_create"
  | "suggest_unique"
  | "incomplete_plot"
  | "two_characters"
  | "emotional_desire"
  | "story_idea_request"
  | "none";

export type OpenConceptDetection = {
  matched: boolean;
  kind: OpenConceptKind;
  genreHints: string[];
  topicLabel: string;
  /** Prefer offering pairing/dynamics options in the reply. */
  preferOfferType: "pairings" | "dynamics" | "openings" | "tones" | "conflicts";
};

const TWO_CHARACTERS =
  /\b(only\s+)?(two|2|do)\s+characters?\b|\bsirf\s+do\s+characters?\b|\bi\s+have\s+only\s+two\b|\bdo\s+characters?\s+(se|hi)\b/i;

const INCOMPLETE_PLOT =
  /\b(don'?t|dont|do\s+not)\s+know\s+(the\s+)?(full\s+)?plot\b|\bplot\s+nahi\s+pata\b|\bmujhe\s+plot\s+nahi\b|\bno\s+plot\s+yet\b|\bfull\s+plot\s+nahi\b|\bidea\s+adhura\b|\brough\s+idea\b/i;

const STORY_IDEA =
  /\bstory\s+idea\s+chahiye\b|\bidea\s+chahiye\b|\bkuch\s+unique\b|\bsuggest\s+something\b|\bsuggest\s+(ideas?|options?|concepts?)\b/i;

const EMOTIONAL =
  /\bi\s+want\s+something\s+emotional\b|\bemotional\s+story\b|\bsomething\s+emotional\b|\bzyada\s+emotional\b/i;

const GENRE_DESIRE =
  /\bi\s+want\s+(a\s+|an\s+)?[\w\s-]{2,40}\b|\bmujhe\s+[\w\s-]{2,30}\s+(chahiye|story)\b|\b(help\s+me\s+create|create\s+a|make\s+a)\b.+\b(story|romance|thriller|horror|fantasy|drama)\b/i;

/**
 * Detect open-ended concept collaboration requests.
 */
export function detectOpenConcept(message: string): OpenConceptDetection {
  const text = message.trim();
  const concept = extractStoryConcept(text);
  const empty = {
    matched: false,
    kind: "none" as const,
    genreHints: [] as string[],
    topicLabel: concept.topicLabel,
    preferOfferType: "openings" as const,
  };
  if (!text || text.length < 3) return empty;
  if (/^(hey|hi|hello|hola|salam|namaste)[!?.]*$/i.test(text)) return empty;

  if (TWO_CHARACTERS.test(text)) {
    return {
      matched: true,
      kind: "two_characters",
      genreHints: concept.genreHints,
      topicLabel: concept.topicLabel,
      preferOfferType: "dynamics",
    };
  }

  if (INCOMPLETE_PLOT.test(text)) {
    return {
      matched: true,
      kind: "incomplete_plot",
      genreHints: concept.genreHints,
      topicLabel: concept.topicLabel,
      preferOfferType: "openings",
    };
  }

  if (STORY_IDEA.test(text) || /\bsuggest\s+something\s+unique\b/i.test(text)) {
    return {
      matched: true,
      kind: "suggest_unique",
      genreHints: concept.genreHints,
      topicLabel: concept.topicLabel,
      preferOfferType: "openings",
    };
  }

  if (EMOTIONAL.test(text)) {
    return {
      matched: true,
      kind: "emotional_desire",
      genreHints: concept.genreHints.length
        ? concept.genreHints
        : ["emotional drama"],
      topicLabel: concept.topicLabel,
      preferOfferType: "tones",
    };
  }

  if (isConceptCreateRequest(text) || GENRE_DESIRE.test(text)) {
    const preferOfferType =
      concept.genreHints.some((g) => /romance/i.test(g))
        ? "pairings"
        : concept.genreHints.some((g) => /horror|thriller|mystery/i.test(g))
          ? "conflicts"
          : "openings";
    return {
      matched: true,
      kind: concept.genreHints.length ? "genre_desire" : "help_create",
      genreHints: concept.genreHints,
      topicLabel: concept.topicLabel,
      preferOfferType,
    };
  }

  return empty;
}

/** Anti-wizard: reject checklist-style assistant replies. */
export function looksLikeWizardChecklist(reply: string): boolean {
  const lower = reply.toLowerCase();
  return (
    /working title/.test(lower) ||
    /target audience/.test(lower) ||
    /at least one main character/.test(lower) ||
    /provide the following/.test(lower) ||
    /missing fields?/.test(lower) ||
    /please provide:/.test(lower) ||
    (/\bgenre\b/.test(lower) &&
      /\blanguage\b/.test(lower) &&
      (/\bpov\b/.test(lower) || /\bpacing\b/.test(lower))) ||
    (/\btitle\b/.test(lower) &&
      /\bgenre\b/.test(lower) &&
      /\blanguage\b/.test(lower) &&
      /\bcharacter\b/.test(lower))
  );
}

export const COLLABORATIVE_FAILURE_USER_MESSAGE =
  "I couldn’t finish that reply properly. Please retry once. 🙂";
