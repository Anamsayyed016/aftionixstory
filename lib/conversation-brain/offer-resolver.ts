/**
 * Resolve short user follow-ups against lastOffers / awaiting (Phase A).
 */

import type {
  ConversationFlow,
  ConversationOffer,
} from "@/lib/conversation-brain/collaboration-state";

export type OfferResolution = {
  kind: "offer_selection";
  offer: ConversationOffer;
  confidence: number;
};

export type AwaitingResolution = {
  kind: "awaiting_answer";
  topic: ConversationFlow["awaiting"]["topic"];
  value: string;
  confidence: number;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[×x]/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1);
}

/**
 * Match user message to a previously offered choice.
 * Handles "CEO and intern", "1", "first one", "ceo intern", etc.
 */
export function resolveOfferSelection(
  userMessage: string,
  flow: ConversationFlow
): OfferResolution | null {
  const offers = flow.lastOffers;
  if (!offers.length) return null;

  const text = userMessage.trim();
  if (!text || text.length > 120) return null;

  // Numeric / ordinal picks
  const num = text.match(/^\s*([1-4]|one|two|three|four|first|second|third|fourth)\s*[.!]?\s*$/i);
  if (num) {
    const map: Record<string, number> = {
      "1": 0,
      one: 0,
      first: 0,
      "2": 1,
      two: 1,
      second: 1,
      "3": 2,
      three: 2,
      third: 2,
      "4": 3,
      four: 3,
      fourth: 3,
    };
    const idx = map[num[1].toLowerCase()];
    if (typeof idx === "number" && offers[idx]) {
      return { kind: "offer_selection", offer: offers[idx], confidence: 0.96 };
    }
  }

  const msgNorm = normalize(text);
  const msgTokens = tokens(text);

  let best: { offer: ConversationOffer; score: number } | null = null;
  for (const offer of offers) {
    const labelNorm = normalize(offer.label);
    const valueNorm = normalize(offer.value.replace(/_/g, " "));
    if (!labelNorm) continue;

    if (msgNorm === labelNorm || msgNorm === valueNorm) {
      return { kind: "offer_selection", offer, confidence: 0.99 };
    }
    if (
      msgNorm.includes(labelNorm) ||
      labelNorm.includes(msgNorm) ||
      (valueNorm.length > 3 && msgNorm.includes(valueNorm))
    ) {
      const score = 0.92;
      if (!best || score > best.score) best = { offer, score };
      continue;
    }

    const labelTokens = tokens(offer.label);
    if (labelTokens.length >= 2) {
      const hits = labelTokens.filter((t) => msgTokens.includes(t)).length;
      const score = hits / labelTokens.length;
      if (score >= 0.75) {
        if (!best || score > best.score) best = { offer, score: 0.8 + score * 0.15 };
      }
    }
  }

  if (best && best.score >= 0.8) {
    return {
      kind: "offer_selection",
      offer: best.offer,
      confidence: best.score,
    };
  }
  return null;
}

/**
 * Resolve short answers to an awaiting question (e.g. "the intern").
 */
export function resolveAwaitingAnswer(
  userMessage: string,
  flow: ConversationFlow
): AwaitingResolution | null {
  if (flow.awaiting.type === "none" || flow.awaiting.topic === "none") {
    return null;
  }
  const text = userMessage.trim();
  if (!text || text.length > 80) return null;
  // Prefer offer match first
  if (resolveOfferSelection(text, flow)) return null;

  const topic = flow.awaiting.topic;
  const lower = text.toLowerCase();

  if (topic === "who_falls_first") {
    if (/\bintern\b/i.test(text)) {
      return {
        kind: "awaiting_answer",
        topic,
        value: "intern",
        confidence: 0.95,
      };
    }
    if (/\bceo\b|\bboss\b/i.test(text)) {
      return {
        kind: "awaiting_answer",
        topic,
        value: "ceo",
        confidence: 0.95,
      };
    }
    if (/^(the\s+)?(first|second|him|her|she|he)\b/i.test(text)) {
      return {
        kind: "awaiting_answer",
        topic,
        value: text.replace(/^(the\s+)/i, "").trim(),
        confidence: 0.85,
      };
    }
  }

  if (topic === "pairing" || topic === "character" || topic === "conflict") {
    // Short free-text answer while awaiting
    if (text.split(/\s+/).length <= 8 && !/[?]/.test(text)) {
      return {
        kind: "awaiting_answer",
        topic,
        value: text,
        confidence: 0.8,
      };
    }
  }

  // Generic short answer when awaiting choice
  if (
    flow.awaiting.type === "choice" &&
    text.split(/\s+/).length <= 6 &&
    !/\b(want|suggest|write|scene|episode)\b/i.test(lower)
  ) {
    return {
      kind: "awaiting_answer",
      topic,
      value: text,
      confidence: 0.75,
    };
  }

  return null;
}
