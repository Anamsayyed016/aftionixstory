/**
 * Language fidelity heuristics (Phase G.5).
 */

import type { StoryGenerationContract } from "@/lib/story-fidelity/schemas";

const HINDI_ROMAN_MARKERS =
  /\b(hai|hain|tha|thi|the|kya|nahi|nahin|main|mein|tum|aap|aur|par|lekin|kyunki|bahut|accha|achha|yaar|bhai|dil|pyaar|mohabbat|class|semester|assignment|library)\b/gi;

const DEVANAGARI = /[\u0900-\u097F]/;

export type LanguageCheck = {
  ok: boolean;
  score: number;
  code?: string;
  message?: string;
  metrics: Record<string, number>;
};

export function validateLanguageFidelity(
  text: string,
  contract: StoryGenerationContract
): LanguageCheck {
  const required = (contract.requiredLanguage || "").toLowerCase();
  if (!required || required === "english") {
    return { ok: true, score: 1, metrics: {} };
  }

  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);
  const romanHits = (text.match(HINDI_ROMAN_MARKERS) || []).length;
  const devanagariHits = (text.match(DEVANAGARI) || []).length;
  const mixRatio = romanHits / wordCount;

  const metrics = {
    wordCount,
    romanHits,
    devanagariHits,
    mixRatio,
  };

  if (required === "hinglish") {
    // Reject near-full English (almost no Hindi-roman markers) and near-full Devanagari
    if (devanagariHits > wordCount * 0.35) {
      return {
        ok: false,
        score: 0.2,
        code: "LANGUAGE_FULL_HINDI",
        message: "Output is mostly Devanagari Hindi; Hinglish required",
        metrics,
      };
    }
    if (romanHits < 8 && mixRatio < 0.04) {
      return {
        ok: false,
        score: 0.25,
        code: "LANGUAGE_FULL_ENGLISH",
        message: "Output is English-only; Hinglish mix required",
        metrics,
      };
    }
    const score = Math.min(1, 0.4 + mixRatio * 8);
    return { ok: score >= 0.45, score, metrics };
  }

  if (required === "hindi") {
    if (devanagariHits < 5 && romanHits < 10) {
      return {
        ok: false,
        score: 0.2,
        code: "LANGUAGE_NOT_HINDI",
        message: "Hindi/Hinglish markers missing",
        metrics,
      };
    }
    return { ok: true, score: 0.8, metrics };
  }

  return { ok: true, score: 0.9, metrics };
}
