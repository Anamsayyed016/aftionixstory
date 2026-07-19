/**
 * Dynamic concept / brainstorm replies derived from the current user message.
 * No hardcoded single genre — works for romance, thriller, fantasy, etc.
 */

export type ConceptExtraction = {
  topicLabel: string;
  genreHints: string[];
  obstacleHints: string[];
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
  /\b(help\s+me\s+create|create\s+a|i\s+want\s+a|make\s+a|suggest\s+a|story\s+about|concept|idea|brainstorm)\b/i;

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
      .replace(/^(help\s+me\s+create|create\s+a|i\s+want\s+a|make\s+a|suggest\s+a)\s+/i, "")
      .replace(/\bstory\b/gi, "")
      .trim()
      .slice(0, 80) ||
    "your story idea";

  const obstacleHints =
    /romance|love|forbidden/i.test(topicLabel)
      ? ["family opposition", "age gap", "social status", "hidden past"]
      : /thriller|crime|mystery/i.test(topicLabel)
        ? ["a ticking clock", "a betrayal", "a false lead"]
        : /horror|supernatural/i.test(topicLabel)
          ? ["an escalating threat", "a cursed place", "a secret the lead can’t admit"]
          : /fantasy|sci-?fi/i.test(topicLabel)
            ? ["a forbidden power", "a broken oath", "a world rule that traps them"]
            : ["an internal conflict", "an external pressure", "a secret"];

  const fingerprint = `${text.length}:${text.slice(0, 24).toLowerCase()}`;

  return { topicLabel, genreHints, obstacleHints, fingerprint };
}

export function buildConceptBrainstormReply(message: string): {
  assistantReply: string;
  suggestions: Array<{ label: string; prompt: string }>;
  memoryConcept: string;
} {
  const { topicLabel, obstacleHints } = extractStoryConcept(message);
  const o1 = obstacleHints[0];
  const o2 = obstacleHints[1];
  const o3 = obstacleHints[2];

  const assistantReply = `Bilkul ❤️ “${topicLabel}” ko hum emotional, slow-burn, ya intense direction me build kar sakte hain. Aap kis type ka core conflict chahti ho—${o1}, ${o2}, ya ${o3}?`;

  const suggestions = [
    {
      label: `Focus on ${o1}`,
      prompt: `Build the ${topicLabel} around ${o1}.`,
    },
    {
      label: `Focus on ${o2}`,
      prompt: `Build the ${topicLabel} around ${o2}.`,
    },
    {
      label: "Suggest 3 openings",
      prompt: `Suggest three unique opening situations for a ${topicLabel} story.`,
    },
  ];

  return {
    assistantReply,
    suggestions,
    memoryConcept: topicLabel,
  };
}

/** True if assistant reply is the generic onboarding greeting (should never answer a concept request). */
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
