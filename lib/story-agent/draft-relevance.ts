/**
 * Lightweight creative-draft relevance checks against the current request.
 */

import type { ResolvedSceneRequest } from "@/lib/story-agent/entity-resolver";
import type { CanonicalStoryContext } from "@/lib/story-agent/canonical-story-context";
import { isReservedPseudoEntityName } from "@/lib/story-agent/entity-guards";

export type DraftRelevanceResult = {
  ok: boolean;
  reason?: string;
  missingCharacters: string[];
  foreignDominantNames: string[];
  generatedNameFingerprints: string[];
  conceptOk: boolean;
  violationCodes: string[];
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
  canonicalContext?: CanonicalStoryContext;
}): DraftRelevanceResult {
  const { resolved, title, content } = params;
  const body = `${title}\n${content}`.toLowerCase();
  const generated = extractGeneratedNameCandidates(title, content);
  const generatedNameFingerprints = generated.map(
    (n) => `${n.length}:${n.slice(0, 12).toLowerCase()}`
  );
  const canonical = params.canonicalContext;
  const canonicalNames = canonical?.characters.map((character) => character.name) ?? [];
  const canonicalLocations = canonical?.locations ?? [];
  const canonicalWords = new Set(
    [...canonicalNames, ...canonicalLocations]
      .flatMap((value) => value.toLowerCase().split(/\s+/))
      .filter(Boolean)
  );
  const canonicalNamePresent = canonicalNames.some((name) =>
    body.includes(name.toLowerCase())
  );

  const missingCharacters = resolved.characterNames.filter(
    (name) => !body.includes(name.toLowerCase())
  );

  const requestedLower = new Set(
    resolved.characterNames.map((n) => n.toLowerCase())
  );
  const foreignDominantNames = generated.filter(
    (n) =>
      !requestedLower.has(n.toLowerCase()) &&
      !canonicalWords.has(n.toLowerCase())
  );
  const violations: string[] = [];
  if (generated.some((name) => isReservedPseudoEntityName(name))) {
    violations.push("PSEUDO_ENTITY_AS_CHARACTER");
  }
  if (canonical?.rawSynopsis && !canonicalNamePresent) {
    violations.push("MISSING_REQUIRED_CHARACTER");
  }
  if (
    canonical?.rawSynopsis &&
    !canonicalNamePresent &&
    foreignDominantNames.length >= 1
  ) {
    violations.push("UNKNOWN_LEAD_CHARACTER");
  }
  if (canonical?.rawSynopsis) {
    const locationAnchor = canonicalLocations.some((location) =>
      body.includes(location.toLowerCase())
    );
    const relationshipAnchor = canonical.relationships.some(
      (relationship) =>
        body.includes(relationship.from.toLowerCase()) &&
        body.includes(relationship.to.toLowerCase())
    );
    const plotTerms = canonical.plotFacts
      .flatMap((fact) => fact.toLowerCase().match(/[a-z]{5,}/g) ?? [])
      .filter(
        (word) =>
          !canonicalWords.has(word) &&
          !["story", "their", "would", "about", "after", "before", "with", "from", "that", "this", "years"].includes(word)
      );
    const plotAnchor = plotTerms.some((word) => body.includes(word));
    if (!locationAnchor && !relationshipAnchor && !plotAnchor) {
      violations.push("MISSING_CANONICAL_PLOT_ANCHOR");
    }
    if (
      /\b(strangers?|never\s+met|unrelated)\b/i.test(body) &&
      canonical.relationships.length > 0
    ) {
      violations.push("RELATIONSHIP_CONTRADICTION");
    }
    if (
      /\b(?:harbor market|first ledger|token)\b/i.test(body) &&
      !canonicalLocations.some((location) => body.includes(location.toLowerCase()))
    ) {
      violations.push("LOCATION_DRIFT");
    }
    if (
      /hinglish/i.test(canonical.language) &&
      content.length >= 80 &&
      !/\b(hai|hain|tha|thi|kya|nahi|tum|main|aur|se|ko|ka|ki|ke)\b/i.test(content)
    ) {
      violations.push("LANGUAGE_MISMATCH");
    }
    if (content.trim().length < 80) violations.push("EMPTY_LIVE_SCENE");
    if (
      /\b(?:teaser|synopsis|backstory|prologue)\b/i.test(content) &&
      !/["“”]|\b(said|bol[ai]|kaha|asked|replied)\b/i.test(content)
    ) {
      violations.push("INTRO_ONLY_OUTPUT");
    }
  }

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
      violationCodes: ["MISSING_REQUIRED_CHARACTER"],
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
      violationCodes: ["MISSING_REQUIRED_CHARACTER"],
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
      violationCodes: ["MISSING_REQUIRED_CHARACTER", "UNKNOWN_LEAD_CHARACTER"],
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
      violationCodes: ["MISSING_REQUIRED_CHARACTER"],
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
      violationCodes: ["MISSING_REQUIRED_CHARACTER"],
    };
  }

  if (violations.length > 0) {
    return {
      ok: false,
      reason: violations[0].toLowerCase(),
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk,
      violationCodes: Array.from(new Set(violations)),
    };
  }

  return {
    ok: true,
    missingCharacters,
    foreignDominantNames,
    generatedNameFingerprints,
    conceptOk,
    violationCodes: [],
  };
}
