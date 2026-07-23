/**
 * Lightweight creative-draft relevance checks against the current request.
 *
 * Grounding rules (intentionally subset-friendly):
 * - Do NOT require every canonical character in every opening scene.
 * - Pass when ≥1 relevant canonical lead appears AND the scene connects to a
 *   canonical conflict/plot/location/relationship anchor.
 * - Fail when the draft replaces the established universe with unrelated leads.
 */

import type { ResolvedSceneRequest } from "@/lib/story-agent/entity-resolver";
import type { CanonicalStoryContext } from "@/lib/story-agent/canonical-story-context";
import {
  isHinglishFunctionWord,
  isReservedPseudoEntityName,
} from "@/lib/story-agent/entity-guards";

export type DraftRelevanceResult = {
  ok: boolean;
  reason?: string;
  missingCharacters: string[];
  foreignDominantNames: string[];
  generatedNameFingerprints: string[];
  conceptOk: boolean;
  violationCodes: string[];
  /** Exact checks that rejected (or would have rejected) the draft. */
  diagnostics: {
    canonicalLeadsPresent: string[];
    hardRequiredMissing: string[];
    hasPlotAnchor: boolean;
    hasRelationshipAnchor: boolean;
    hasLocationAnchor: boolean;
    rejectingChecks: string[];
  };
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
    if (isReservedPseudoEntityName(name) || isHinglishFunctionWord(name)) {
      continue;
    }
    found.add(name);
  }
  return Array.from(found);
}

function namePresent(body: string, name: string): boolean {
  const lower = body.toLowerCase();
  const full = name.toLowerCase();
  if (lower.includes(full)) return true;
  // Allow first/last token of multi-word names ("Azar Sayyed" ↔ "Azar")
  const parts = full.split(/\s+/).filter((part) => part.length >= 3);
  return parts.some((part) => new RegExp(`\\b${part}\\b`, "i").test(body));
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

  const hardRequired = resolved.characterNames;
  const hardRequiredMissing = hardRequired.filter(
    (name) => !namePresent(body, name)
  );
  // Back-compat alias used by callers/tests
  const missingCharacters = hardRequiredMissing;

  const requestedLower = new Set(
    [
      ...hardRequired,
      ...(resolved.softContextCharacters ?? []),
      ...canonicalNames,
    ].map((n) => n.toLowerCase())
  );
  const foreignDominantNames = generated.filter(
    (n) =>
      !requestedLower.has(n.toLowerCase()) &&
      !canonicalWords.has(n.toLowerCase()) &&
      !isReservedPseudoEntityName(n)
  );

  const canonicalLeadsPresent = canonicalNames.filter((name) =>
    namePresent(body, name)
  );
  const canonicalNamePresent = canonicalLeadsPresent.length > 0;

  const locationAnchor = canonicalLocations.some((location) =>
    body.includes(location.toLowerCase())
  );
  const relationshipAnchor = (canonical?.relationships ?? []).some(
    (relationship) =>
      namePresent(body, relationship.from) && namePresent(body, relationship.to)
  );
  const plotTerms = (canonical?.plotFacts ?? [])
    .flatMap((fact) => fact.toLowerCase().match(/[a-z]{4,}/g) ?? [])
    .filter(
      (word) =>
        !["story", "their", "would", "about", "after", "before", "with", "from", "that", "this", "years", "later", "when", "then"].includes(
          word
        )
    );
  const plotAnchor =
    plotTerms.some((word) => body.includes(word)) ||
    /\b(nikah|marri|refus|slap|thappad|pregnan|paris|secret|partner|romance|love)\b/i.test(
      body
    );

  const violations: string[] = [];
  const rejectingChecks: string[] = [];

  if (generated.some((name) => isReservedPseudoEntityName(name))) {
    violations.push("PSEUDO_ENTITY_AS_CHARACTER");
    rejectingChecks.push("PSEUDO_ENTITY_AS_CHARACTER");
  }

  if (canonical?.rawSynopsis) {
    if (!canonicalNamePresent) {
      violations.push("MISSING_REQUIRED_CHARACTER");
      rejectingChecks.push("no_canonical_lead_present");
    }

    if (!canonicalNamePresent && foreignDominantNames.length >= 1) {
      violations.push("UNKNOWN_LEAD_CHARACTER");
      rejectingChecks.push("foreign_leads_without_canonical");
    }

    // Universe replacement: foreign leads dominate even if a token weakly matched
    if (
      foreignDominantNames.length >= 2 &&
      canonicalLeadsPresent.length === 0
    ) {
      if (!violations.includes("UNKNOWN_LEAD_CHARACTER")) {
        violations.push("UNKNOWN_LEAD_CHARACTER");
      }
      rejectingChecks.push("unrelated_universe_leads");
    }

    if (!locationAnchor && !relationshipAnchor && !plotAnchor) {
      violations.push("MISSING_CANONICAL_PLOT_ANCHOR");
      rejectingChecks.push("missing_plot_relationship_or_location_anchor");
    }

    if (
      /\b(strangers?|never\s+met|unrelated)\b/i.test(body) &&
      (canonical.relationships?.length ?? 0) > 0 &&
      canonicalNamePresent
    ) {
      violations.push("RELATIONSHIP_CONTRADICTION");
      rejectingChecks.push("relationship_contradiction");
    }

    if (
      /\b(?:harbor market|first ledger|token)\b/i.test(body) &&
      !canonicalLocations.some((location) =>
        body.includes(location.toLowerCase())
      ) &&
      !canonicalNamePresent
    ) {
      violations.push("LOCATION_DRIFT");
      rejectingChecks.push("location_drift_unrelated_setting");
    }

    if (
      /hinglish/i.test(canonical.language) &&
      content.length >= 80 &&
      !/\b(hai|hain|tha|thi|kya|nahi|tum|main|aur|se|ko|ka|ki|ke|ne|liye|toh|woh|yeh)\b/i.test(
        content
      )
    ) {
      violations.push("LANGUAGE_MISMATCH");
      rejectingChecks.push("hinglish_markers_missing");
    }

    if (content.trim().length < 80) {
      violations.push("EMPTY_LIVE_SCENE");
      rejectingChecks.push("scene_too_short");
    }

    if (
      /\b(?:teaser|synopsis|backstory|prologue)\b/i.test(content) &&
      !/["“”]|\b(said|bol[ai]|kaha|asked|replied)\b/i.test(content)
    ) {
      violations.push("INTRO_ONLY_OUTPUT");
      rejectingChecks.push("intro_only_no_live_dialogue");
    }
  }

  // Explicit hard-required names from the user message (not memory fallback)
  if (
    hardRequired.length >= 1 &&
    hardRequiredMissing.length === hardRequired.length &&
    foreignDominantNames.length > 0
  ) {
    violations.push("MISSING_REQUIRED_CHARACTER", "UNKNOWN_LEAD_CHARACTER");
    rejectingChecks.push("explicit_requested_cast_missing_foreign_leads");
  } else if (
    hardRequired.length >= 2 &&
    hardRequiredMissing.length === hardRequired.length
  ) {
    // Only fail all-missing when user named 2+ explicitly AND none appear
    violations.push("MISSING_REQUIRED_CHARACTER");
    rejectingChecks.push("all_explicit_requested_characters_missing");
  } else if (
    hardRequired.length >= 2 &&
    hardRequiredMissing.length >= hardRequired.length &&
    !canonicalNamePresent
  ) {
    violations.push("MISSING_REQUIRED_CHARACTER");
    rejectingChecks.push("explicit_cast_and_canonical_missing");
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

  const diagnostics = {
    canonicalLeadsPresent,
    hardRequiredMissing,
    hasPlotAnchor: plotAnchor,
    hasRelationshipAnchor: relationshipAnchor,
    hasLocationAnchor: locationAnchor,
    rejectingChecks: Array.from(new Set(rejectingChecks)),
  };

  // Copy of unrelated previous draft title
  if (
    params.previousDraftTitle &&
    title.trim().length > 0 &&
    title.trim().toLowerCase() === params.previousDraftTitle.trim().toLowerCase() &&
    hardRequired.length > 0 &&
    hardRequiredMissing.length === hardRequired.length
  ) {
    return {
      ok: false,
      reason: "draft_title_matches_unrelated_previous",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk: false,
      violationCodes: ["MISSING_REQUIRED_CHARACTER"],
      diagnostics: {
        ...diagnostics,
        rejectingChecks: [
          ...diagnostics.rejectingChecks,
          "previous_draft_title_reuse",
        ],
      },
    };
  }

  if (
    params.previousDraftFingerprint &&
    content.slice(0, 120).toLowerCase() ===
      params.previousDraftFingerprint.toLowerCase() &&
    (hardRequiredMissing.length > 0 || !canonicalNamePresent)
  ) {
    return {
      ok: false,
      reason: "draft_body_matches_previous_fingerprint",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk: false,
      violationCodes: ["MISSING_REQUIRED_CHARACTER"],
      diagnostics: {
        ...diagnostics,
        rejectingChecks: [
          ...diagnostics.rejectingChecks,
          "previous_draft_body_reuse",
        ],
      },
    };
  }

  if (!conceptOk && hardRequired.length > 0 && hardRequiredMissing.length > 0) {
    return {
      ok: false,
      reason: "concept_and_characters_mismatch",
      missingCharacters,
      foreignDominantNames,
      generatedNameFingerprints,
      conceptOk,
      violationCodes: Array.from(
        new Set([...violations, "MISSING_REQUIRED_CHARACTER"])
      ),
      diagnostics: {
        ...diagnostics,
        rejectingChecks: [
          ...diagnostics.rejectingChecks,
          "concept_and_characters_mismatch",
        ],
      },
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
      diagnostics,
    };
  }

  return {
    ok: true,
    missingCharacters,
    foreignDominantNames,
    generatedNameFingerprints,
    conceptOk,
    violationCodes: [],
    diagnostics: {
      ...diagnostics,
      rejectingChecks: [],
    },
  };
}
