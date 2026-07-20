/**
 * Lightweight collaborative conversation flow (Phase A).
 * Stored in Conversation.state JSON — no Prisma migration.
 */

export type ConversationPhase =
  | "open"
  | "exploring"
  | "shaping"
  | "ready_to_write"
  | "writing";

export type OfferType =
  | "pairings"
  | "conflicts"
  | "tones"
  | "openings"
  | "twists"
  | "dynamics"
  | "none";

export type AwaitingType = "choice" | "clarification" | "confirmation" | "none";

export type AwaitingTopic =
  | "pairing"
  | "conflict"
  | "tone"
  | "setting"
  | "character"
  | "who_falls_first"
  | "none";

export type ConversationOffer = {
  id: string;
  label: string;
  value: string;
  /** Prompt sent when the chip is clicked. */
  prompt: string;
};

export type AwaitingState = {
  type: AwaitingType;
  topic: AwaitingTopic;
};

export type ConversationFlow = {
  phase: ConversationPhase;
  lastIntent: string;
  lastOfferType: OfferType;
  lastOffers: ConversationOffer[];
  awaiting: AwaitingState;
  generationBlocked: boolean;
  updatedAt?: string;
};

export type ConversationFlowPatch = Partial<{
  phase: ConversationPhase;
  lastIntent: string;
  lastOfferType: OfferType;
  lastOffers: ConversationOffer[];
  awaiting: AwaitingState;
  generationBlocked: boolean;
}>;

export const DEFAULT_CONVERSATION_FLOW: ConversationFlow = {
  phase: "open",
  lastIntent: "",
  lastOfferType: "none",
  lastOffers: [],
  awaiting: { type: "none", topic: "none" },
  generationBlocked: false,
};

function isOfferType(v: unknown): v is OfferType {
  return (
    v === "pairings" ||
    v === "conflicts" ||
    v === "tones" ||
    v === "openings" ||
    v === "twists" ||
    v === "dynamics" ||
    v === "none"
  );
}

function isPhase(v: unknown): v is ConversationPhase {
  return (
    v === "open" ||
    v === "exploring" ||
    v === "shaping" ||
    v === "ready_to_write" ||
    v === "writing"
  );
}

function normalizeOffer(raw: unknown, index: number): ConversationOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const value =
    typeof o.value === "string" && o.value.trim()
      ? o.value.trim()
      : label.toLowerCase().replace(/\s+/g, "_").slice(0, 64);
  const id =
    typeof o.id === "string" && o.id.trim()
      ? o.id.trim()
      : `offer_${index}_${value}`;
  const prompt =
    typeof o.prompt === "string" && o.prompt.trim()
      ? o.prompt.trim()
      : label;
  return { id, label, value, prompt };
}

/** Parse conversationFlow from Conversation.state (safe defaults). */
export function readConversationFlow(state: unknown): ConversationFlow {
  if (!state || typeof state !== "object") {
    return { ...DEFAULT_CONVERSATION_FLOW, lastOffers: [] };
  }
  const root = state as Record<string, unknown>;
  const raw = root.conversationFlow;
  if (!raw || typeof raw !== "object") {
    // Migrate generationBlocked from userPreferences when present
    const prefs = root.userPreferences as Record<string, unknown> | undefined;
    const blocked = Boolean(prefs?.doNotStartYet);
    return {
      ...DEFAULT_CONVERSATION_FLOW,
      lastOffers: [],
      generationBlocked: blocked,
    };
  }

  const flow = raw as Record<string, unknown>;
  const awaitingRaw =
    flow.awaiting && typeof flow.awaiting === "object"
      ? (flow.awaiting as Record<string, unknown>)
      : {};
  const offersRaw = Array.isArray(flow.lastOffers) ? flow.lastOffers : [];
  const lastOffers = offersRaw
    .map((o, i) => normalizeOffer(o, i))
    .filter((o): o is ConversationOffer => Boolean(o))
    .slice(0, 4);

  return {
    phase: isPhase(flow.phase) ? flow.phase : "open",
    lastIntent: typeof flow.lastIntent === "string" ? flow.lastIntent : "",
    lastOfferType: isOfferType(flow.lastOfferType) ? flow.lastOfferType : "none",
    lastOffers,
    awaiting: {
      type:
        awaitingRaw.type === "choice" ||
        awaitingRaw.type === "clarification" ||
        awaitingRaw.type === "confirmation" ||
        awaitingRaw.type === "none"
          ? awaitingRaw.type
          : "none",
      topic:
        awaitingRaw.topic === "pairing" ||
        awaitingRaw.topic === "conflict" ||
        awaitingRaw.topic === "tone" ||
        awaitingRaw.topic === "setting" ||
        awaitingRaw.topic === "character" ||
        awaitingRaw.topic === "who_falls_first" ||
        awaitingRaw.topic === "none"
          ? awaitingRaw.topic
          : "none",
    },
    generationBlocked: Boolean(flow.generationBlocked),
    updatedAt: typeof flow.updatedAt === "string" ? flow.updatedAt : undefined,
  };
}

export function mergeConversationFlow(
  current: ConversationFlow,
  patch: ConversationFlowPatch
): ConversationFlow {
  return {
    phase: patch.phase ?? current.phase,
    lastIntent: patch.lastIntent ?? current.lastIntent,
    lastOfferType: patch.lastOfferType ?? current.lastOfferType,
    lastOffers:
      patch.lastOffers !== undefined
        ? patch.lastOffers.slice(0, 4)
        : current.lastOffers,
    awaiting: patch.awaiting ?? current.awaiting,
    generationBlocked:
      typeof patch.generationBlocked === "boolean"
        ? patch.generationBlocked
        : current.generationBlocked,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeOffers(
  offers: Array<Partial<ConversationOffer> | { label: string; prompt?: string }>
): ConversationOffer[] {
  const out: ConversationOffer[] = [];
  for (let i = 0; i < offers.length && out.length < 4; i++) {
    const o = offers[i];
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const value =
      "value" in o && typeof o.value === "string" && o.value.trim()
        ? o.value.trim()
        : label.toLowerCase().replace(/[^a-z0-9]+/gi, "_").slice(0, 64);
    const id =
      "id" in o && typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : `offer_${out.length}_${value}`;
    const prompt =
      typeof o.prompt === "string" && o.prompt.trim()
        ? o.prompt.trim()
        : label;
    if (out.some((x) => x.label.toLowerCase() === label.toLowerCase())) continue;
    out.push({ id, label, value, prompt });
  }
  return out;
}

export function offersToSuggestions(
  offers: ConversationOffer[]
): Array<{ label: string; prompt: string }> {
  return offers.map((o) => ({ label: o.label, prompt: o.prompt || o.label }));
}
