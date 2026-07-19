/**
 * Lightweight creative-draft relevance checks against the current request.
 */

import type { ResolvedSceneRequest } from "@/lib/story-agent/entity-resolver";

export type DraftRelevanceResult = {
  ok: boolean;
  reason?: string;
  missingCharacters: string[];
  foreignDominantNames: string[];
  generatedNameFingerprints: string[];
  conceptOk: boolean;
};

const COMMON_WORDS = new Set(
  [
    "the",
    "and",
    "she",
    "he",
    "her",
    "his",
    "they",
    "them",
    "with",
    "from",
    "that",
    "this",
    "was",
    "were",
    "had",
    "have",
    "been",
    "into",
    "over",
    "under",
    "then",
    "when",
    "what",
    "where",
    "while",
    "after",
    "before",
    "about",
    "there",
    "their",
    "said",
    "just",
    "only",
    "like",
    "back",
    "down",
    "even",
    "still",
    "again",
    "title",
    "untitled",
    "scene",
    "draft",
    "episode",
  ].map((s) => s.toLowerCase())
);

/** Proper-name-like tokens in draft (heuristic). */
export function extractGeneratedNameCandidates(
  title: string,
  content: string
): string[] {
  const text = `${title}\n${content}`;
  const found = new Set<string>();
  const re = /\b([A-Z][a-z]{1,28})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (COMMON_WORDS.has(name.toLowerCase())) continue;
    found.add(name);
  }
  return Array.from(found);
}

export function assessDraftRelevance(params: {
  userMessage: string;
  title: string;
  content: string;
  resolved: ResolvedSceneRequest;
  previousDraftTitle?: string | null;
  previousDraftFingerprint?: string | null;
}): DraftRelevanceResult {
  const { resolved, title, content } = params;
  const body = `${title}\n${content}`.toLowerCase();
  const generated = extractGeneratedNameCandidates(title, content);
  const generatedNameFingerprints = generated.map(
    (n) => `${n.length}:${n.slice(0, 12).toLowerCase()}`
  );

  const missingCharacters = resolved.characterNames.filter(
    (name) => !body.includes(name.toLowerCase())
  );

  const requestedLower = new Set(
    resolved.characterNames.map((n) => n.toLowerCase())
  );
  const foreignDominantNames = generated.filter(
    (n) => !requestedLower.has(n.toLowerCase())
  );

  // Concept signals (soft)
  let conceptOk = true;
  if (resolved.actionHints.some((h) => /kiss|intimate/i.test(h))) {
    conceptOk =
      /\b(kiss|lips|close|breath|touch|near|lean|pull)\b/i.test(body) ||
      /\b(feelings?|desire|attraction|heart)\b/i.test(body);
  }
  if (resolved.conflictHints.some((h) => /internal|conflict|guilt|fear/i.test(h))) {
    const conflictOk =
      /\b(guilt|fear|doubt|conflict|hesitat|shouldn|shouldn't|wrong|resist|deny|afraid|shame|torn)\b/i.test(
        body
      );
    conceptOk = conceptOk && conflictOk;
  }

  // Copy of unrelated previous draft title
  if (
    params.previousDraftTitle &&
    title.trim().length > 0 &&
    title.trim().toLowerCase() === params.previousDraftTitle.trim().toLowerCase() &&
    resolved.characterNames.length > 0 &&
    missingCharacters.length === resolved.characterNames.length
  ) {
    return {
      ok: false,
      reason: "draft_title_matches_unrelated_previous",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk: false,
    };
  }

  if (
    params.previousDraftFingerprint &&
    content.slice(0, 120).toLowerCase() ===
      params.previousDraftFingerprint.toLowerCase() &&
    missingCharacters.length > 0
  ) {
    return {
      ok: false,
      reason: "draft_body_matches_previous_fingerprint",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk: false,
    };
  }

  // Hard fail: requested leads missing AND foreign names dominate
  if (
    resolved.characterNames.length >= 1 &&
    missingCharacters.length === resolved.characterNames.length &&
    foreignDominantNames.length > 0
  ) {
    return {
      ok: false,
      reason: "requested_characters_missing_foreign_leads",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk,
    };
  }

  if (
    resolved.characterNames.length >= 2 &&
    missingCharacters.length >= 2
  ) {
    return {
      ok: false,
      reason: "requested_characters_missing",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk,
    };
  }

  if (!conceptOk && resolved.characterNames.length > 0 && missingCharacters.length > 0) {
    return {
      ok: false,
      reason: "concept_and_characters_mismatch",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk,
    };
  }

  return {
    ok: true,
    missingCharacters,
    foreignDominantNames,
    generatedNameFingerprints,
    conceptOk,
  };
}
