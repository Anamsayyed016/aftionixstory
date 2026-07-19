/**
 * Natural Hinglish quality signals for prompts + lightweight checks.
 * Not blind word replacement — guidance only.
 */

const FORMAL_HINDI_MARKERS = [
  /\bhriday\b/i,
  /\bkripya\b/i,
  /\bkripaya\b/i,
  /\bvyakul\b/i,
  /\bvichlit\b/i,
  /\bpratyuttar\b/i,
  /\batyadhik\b/i,
  /\bsamvedana\b/i,
  /\bkintu\b/i,
  /\btathapi\b/i,
];

const NATURAL_HINGLISH_MARKERS =
  /\b(hai|hain|nahi|nahin|kya|kyun|aur|lekin|par|toh|main|mein|tum|aap|accha|theek|bahut|thoda|yaar|dil|samajh|pasand)\b/gi;

export const NATURAL_HINGLISH_PROMPT = `NATURAL HINGLISH (not translation):
- Use modern spoken Indian language, not textbook Hindi.
- Prefer simple English narration with naturally used Hindi phrases when appropriate.
- Use Latin script unless Devanagari is requested.
- Dialogues should sound like real people: contractions, pauses, interruptions, incomplete emotional lines, body language.
- Preserve names and cultural expressions.
- Avoid mechanical word-for-word translation and overly formal/shuddh Hindi (hriday, kripya, vyakul, vichlit, pratyuttar, atyadhik, samvedana, kintu, tathapi) unless a character truly speaks that way.
- Prefer natural alternatives in context: dil, please, pareshan, confused, reply, bahut, feelings, lekin, phir bhi.
- Do not randomly insert English words just to look Hinglish.
- Do not force Hindi into every sentence.`;

export function countFormalHindiHits(text: string): number {
  return FORMAL_HINDI_MARKERS.filter((re) => re.test(text)).length;
}

export function looksOverlyFormalHinglish(text: string): boolean {
  return countFormalHindiHits(text) >= 2;
}

export function hasNaturalHinglishMix(text: string): boolean {
  const hits = text.match(NATURAL_HINGLISH_MARKERS) || [];
  return hits.length >= 4;
}

export type HinglishQualityResult = {
  ok: boolean;
  reason: string;
  formalHits: number;
};

export function assessHinglishQuality(text: string): HinglishQualityResult {
  const formalHits = countFormalHindiHits(text);
  if (formalHits >= 2) {
    return { ok: false, reason: "too_formal_hindi", formalHits };
  }
  if (!hasNaturalHinglishMix(text)) {
    return { ok: false, reason: "missing_natural_mix", formalHits };
  }
  return { ok: true, reason: "ok", formalHits };
}
