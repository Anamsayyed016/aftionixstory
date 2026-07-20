/**
 * Concept / topic extraction for routing, memory seeding, and safe fingerprints.
 * Does NOT invent user-facing story answers — those come from OpenAI/Gemini only.
 */

export type ConceptExtraction = {
  topicLabel: string;
  genreHints: string[];
  fingerprint: string;
};

const GENRE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bforbidden\s+romance\b/i, label: "forbidden romance" },
  { re: /\bdark\s+romance\b/i, label: "dark romance" },
  { re: /\bromance\b|\bromantic\b/i, label: "romance" },
  { re: /\bthriller\b/i, label: "thriller" },
  { re: /\bhorror\b/i, label: "horror" },
  { re: /\bfantasy\b/i, label: "fantasy" },
  { re: /\bmystery\b/i, label: "mystery" },
  { re: /\bcomedy\b|\bcomic\b/i, label: "comedy" },
  { re: /\bfamily\s+drama\b|\bdrama\b/i, label: "drama" },
  { re: /\bsci-?fi\b|\bscience\s+fiction\b/i, label: "sci-fi" },
  { re: /\bcollege\b/i, label: "college story" },
  { re: /\bcrime\b|\bmafia\b/i, label: "crime" },
  { re: /\bsupernatural\b/i, label: "supernatural" },
  { re: /\bhistorical\b/i, label: "historical" },
];

const CREATE_CONCEPT_SIGNAL =
  /\b(help\s+me\s+create|create\s+a|i\s+want\s+a|make\s+a|suggest\s+a|suggest\s+three|suggest\s+something|serialized\s+story|unique\s+for\s+a|story\s+about|concept|idea|brainstorm|opening\s+situations?)\b/i;

export function isConceptCreateRequest(message: string): boolean {
  const text = message.trim();
  if (!text || text.length < 8) return false;
  if (/^(hey|hi|hello|help|hola)[.!?]*$/i.test(text)) return false;
  return (
    CREATE_CONCEPT_SIGNAL.test(text) ||
    GENRE_PATTERNS.some((g) => g.re.test(text))
  );
}

export function extractStoryConcept(message: string): ConceptExtraction {
  const text = message.trim();
  const genreHints: string[] = [];
  for (const g of GENRE_PATTERNS) {
    if (g.re.test(text) && !genreHints.includes(g.label)) {
      genreHints.push(g.label);
    }
  }

  const topicLabel =
    genreHints[0] ||
    text
      .replace(
        /^(help\s+me\s+create|create\s+a|i\s+want\s+a|make\s+a|suggest\s+a)\s+/i,
        ""
      )
      .replace(/\bstory\b/gi, "")
      .trim()
      .slice(0, 80) ||
    "your story idea";

  const fingerprint = `${text.length}:${text.slice(0, 24).toLowerCase()}`;

  return { topicLabel, genreHints, fingerprint };
}

/** True if assistant reply is the generic onboarding greeting. */
export function looksLikeOnboardingGreeting(reply: string): boolean {
  const lower = reply.toLowerCase();
  return (
    lower.includes("apna rough story idea batao") ||
    lower.includes("ek character, scene, ya sirf ek feeling") ||
    (lower.includes("hey!") &&
      lower.includes("rough") &&
      lower.includes("idea"))
  );
}

/**
 * Detect the obsolete hardcoded concept template (must never be shown as AI success).
 */
export function looksLikeHardcodedConceptTemplate(reply: string): boolean {
  const lower = reply.toLowerCase();
  return (
    lower.includes("emotional, slow-burn") ||
    lower.includes("intense direction me build") ||
    lower.includes("kis type ka core conflict") ||
    (lower.includes("bilkul") &&
      lower.includes("slow-burn") &&
      lower.includes("conflict"))
  );
}

export function responseMentionsTopic(
  reply: string,
  topicLabel: string
): boolean {
  const r = reply.toLowerCase();
  const parts = topicLabel
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 3);
  if (parts.length === 0) return true;
  const hits = parts.filter((p) => r.includes(p)).length;
  return hits >= Math.min(1, parts.length);
}

export function responseFingerprint(reply: string): string {
  const t = reply.trim();
  return `${t.length}:${t.slice(0, 32).toLowerCase()}`;
}

/** User-facing retry copy when a live provider fails — never a fake story answer. */
export const PROVIDER_FAILURE_USER_MESSAGE =
  "I couldn’t generate the story ideas correctly. Please retry once.";

export const BRAINSTORM_FAILURE_USER_MESSAGE =
  "I couldn’t generate the story ideas correctly. Please retry once.";
