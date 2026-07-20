/**
 * Unified hybrid intent router (Phase B) — single authoritative create-chat path.
 *
 * Priority:
 * 1. Idempotency (pure — no side effects)
 * 2. Phase A offer / awaiting resolution
 * 3. generationBlocked controls
 * 4–5. Explicit deterministic commands + corrections / prefs
 * 6–8. Draft-aware revisions, creative generation, story questions
 * 9. Open-concept collaboration
 * 10. Contextual intent scoring
 * 11. LLM classifier when confidence is below threshold
 * 12. Safe normal_chat fallback
 */

import { logAiEvent } from "@/lib/ai/logger";
import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import {
  buildIntentContext,
  type IntentContext,
} from "@/lib/conversation-brain/intent-context";
import {
  classifyIntentWithLlm,
  getIntentConfidenceThreshold,
  isIntentClassifierEnabled,
  unwrapClassifier,
  type ClassifierAttemptMeta,
} from "@/lib/conversation-brain/intent-classifier";
import { scoreContextualIntent } from "@/lib/conversation-brain/intent-contextual";
import { applyIntentOverrides } from "@/lib/conversation-brain/intent-overrides";
import {
  matchDeterministicIntent,
  toRouteResultFromMatch,
} from "@/lib/conversation-brain/intent-rules";
import {
  intentRouteResultSchema,
  isCreativeStoryIntent,
  type IntentRouteResult,
  type StoryIntent,
} from "@/lib/conversation-brain/intents";
import {
  resolveAwaitingAnswer,
  resolveOfferSelection,
  type AwaitingResolution,
  type OfferResolution,
} from "@/lib/conversation-brain/offer-resolver";
import {
  detectOpenConcept,
  type OpenConceptDetection,
} from "@/lib/conversation-brain/open-concept";
import { tryDeterministicTurn } from "@/lib/story-agent/deterministic-router";
// Legacy adapter — create-chat should not call this directly (Phase B).
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import type { StoryMemory } from "@/lib/story-agent/schema";

export type UnifiedRouteExtras = {
  offerResolution?: OfferResolution | null;
  awaitingResolution?: AwaitingResolution | null;
  openConcept?: OpenConceptDetection | null;
  setGenerationBlock?: boolean;
  clearGenerationBlock?: boolean;
  collaborationMode?: boolean;
};

export type UnifiedRouteResult = {
  route: IntentRouteResult;
  context: IntentContext;
  extras: UnifiedRouteExtras;
  classifierMeta: ClassifierAttemptMeta;
};

function emptyEntities() {
  return {
    characterNames: [] as string[],
    episodeNumber: null as number | null,
    requestedTone: null as string | null,
    requestedLanguage: null as string | null,
  };
}

function fallbackNormalChat(
  signals: string[],
  source: IntentRouteResult["source"] = "fallback"
): IntentRouteResult {
  return {
    intent: "normal_chat",
    confidence: 0.5,
    source,
    aiRequired: true,
    creativeGeneration: false,
    needsMemory: true,
    needsDraft: false,
    needsStorySearch: false,
    needsClarification: false,
    clarificationReason: null,
    matchedSignals: signals,
    entities: emptyEntities(),
  };
}

function mapDeterministicLegacy(
  text: string,
  memory: StoryMemory | null | undefined
): { route: IntentRouteResult; extras: UnifiedRouteExtras } | null {
  const det = tryDeterministicTurn(text, memory);
  if (!det.handled) return null;

  let intent: StoryIntent = "normal_chat";
  if (det.intent === "greeting") intent = "greeting";
  else if (det.intent === "do_not_start") intent = "block_generation";
  else if (det.intent === "correct_memory") intent = "memory_correction";
  else if (det.intent === "update_preference") {
    intent = det.matchedSignals.includes("language_preference")
      ? "language_change"
      : "style_change";
  } else if (det.intent === "update_memory") intent = "memory_update";

  return {
    route: {
      intent,
      confidence: det.confidence === "high" ? 0.98 : 0.85,
      source: "deterministic",
      aiRequired: false,
      creativeGeneration: false,
      needsMemory: Boolean(det.memoryPatch),
      needsDraft: false,
      needsStorySearch: false,
      needsClarification: false,
      clarificationReason: null,
      matchedSignals: det.matchedSignals,
      entities: emptyEntities(),
    },
    extras: {
      setGenerationBlock: det.generationBlocked === true,
    },
  };
}

function mapLegacyIntentRouter(
  text: string,
  memory: StoryMemory | null | undefined,
  ctx: IntentContext
): IntentRouteResult {
  const legacy = routeIntent(text, memory);
  let intent: StoryIntent = "normal_chat";

  if (
    legacy.reason === "brainstorm" ||
    legacy.reason === "concept_create_request"
  ) {
    intent = "brainstorm";
  } else if (legacy.operation === "write_scene") intent = "write_scene";
  else if (
    legacy.operation === "generate_episode" ||
    legacy.operation === "start_story"
  ) {
    intent = "write_episode";
  } else if (legacy.operation === "continue_episode") intent = "continue_story";
  else if (legacy.operation === "revise_draft") intent = "rewrite";
  else if (
    legacy.operation === "brainstorm" ||
    legacy.operation === "suggest_options"
  ) {
    intent = "brainstorm";
  } else if (legacy.operation === "memory_update") intent = "memory_update";
  else if (legacy.operation === "summarize") intent = "summarize_story";

  const conf =
    legacy.confidence === "high"
      ? 0.9
      : legacy.confidence === "medium"
        ? 0.7
        : 0.45;

  return applyIntentOverrides(
    {
      intent,
      confidence: conf,
      source: conf >= 0.7 ? "contextual" : "fallback",
      aiRequired: !(legacy.fixedReply && legacy.skipClassifier),
      creativeGeneration: isCreativeStoryIntent(intent),
      needsMemory: true,
      needsDraft: Boolean(
        ctx.hasLatestDraft &&
          (intent === "rewrite" || intent === "continue_story")
      ),
      needsStorySearch: false,
      needsClarification: false,
      clarificationReason: null,
      matchedSignals: legacy.matchedSignals ?? [legacy.reason],
      entities: emptyEntities(),
    },
    ctx
  );
}

/**
 * Sync routing path (no LLM). Used by tests and when classifier is skipped.
 */
export function routeStoryIntentSync(params: {
  userMessage: string;
  memory?: StoryMemory | null;
  flow?: ConversationFlow | null;
  storyId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
}): UnifiedRouteResult {
  const flow = params.flow ?? DEFAULT_CONVERSATION_FLOW;
  const text = params.userMessage.trim();
  const memory = params.memory ?? emptyStoryMemory();
  const builtCtx = buildIntentContext({
    memory,
    flow,
    storyId: params.storyId,
    recentMessages: params.recentMessages,
  });

  const classifierMeta: ClassifierAttemptMeta = { attempted: false, ok: false };

  // 2. Offer / awaiting (Phase A) — never overridden by LLM
  const offerHit = resolveOfferSelection(text, flow);
  if (offerHit) {
    return {
      route: intentRouteResultSchema.parse({
        intent: "offer_selection",
        confidence: offerHit.confidence,
        source: "offer_resolver",
        aiRequired: false,
        creativeGeneration: false,
        needsMemory: true,
        needsDraft: false,
        needsStorySearch: false,
        needsClarification: false,
        clarificationReason: null,
        matchedSignals: ["offer_selection", offerHit.offer.value],
        entities: emptyEntities(),
      }),
      context: builtCtx,
      extras: {
        offerResolution: offerHit,
        collaborationMode: true,
      },
      classifierMeta,
    };
  }

  const awaitingHit = resolveAwaitingAnswer(text, flow);
  if (awaitingHit) {
    return {
      route: intentRouteResultSchema.parse({
        intent: "awaiting_answer",
        confidence: awaitingHit.confidence,
        source: "offer_resolver",
        aiRequired: false,
        creativeGeneration: false,
        needsMemory: true,
        needsDraft: false,
        needsStorySearch: false,
        needsClarification: false,
        clarificationReason: null,
        matchedSignals: ["awaiting_answer", awaitingHit.topic],
        entities: emptyEntities(),
      }),
      context: builtCtx,
      extras: {
        awaitingResolution: awaitingHit,
        collaborationMode: true,
      },
      classifierMeta,
    };
  }

  // 3. Explicit unblock while blocked
  if (
    builtCtx.generationBlocked &&
    /\b(start\s+now|story\s+shuru(\s+karo)?|ab\s+likho|begin(\s+writing)?|start\s+the\s+story|ab\s+start\s+karo)\b/i.test(
      text
    )
  ) {
    return {
      route: toRouteResultFromMatch(
        {
          intent: "unblock_generation",
          confidence: 0.98,
          signals: ["clear_generation_block"],
        },
        "deterministic"
      ),
      context: builtCtx,
      extras: { clearGenerationBlock: true },
      classifierMeta,
    };
  }

  const threshold = getIntentConfidenceThreshold();

  // 4–8. Composable deterministic rules (corrections, draft revise, creative, Q&A)
  // Run before legacy tryDeterministicTurn so emotional/correction intents are not
  // swallowed by broad style/memory parsers.
  const ruleMatch = matchDeterministicIntent(text, builtCtx);
  if (ruleMatch && ruleMatch.confidence >= threshold) {
    let route = applyIntentOverrides(
      toRouteResultFromMatch(ruleMatch, "deterministic"),
      builtCtx
    );
    const extrasFromRule: UnifiedRouteExtras = {};
    if (route.intent === "block_generation") {
      extrasFromRule.setGenerationBlock = true;
    }
    if (route.intent === "unblock_generation") {
      extrasFromRule.clearGenerationBlock = true;
    }
    if (
      builtCtx.generationBlocked &&
      (route.matchedSignals.includes("generation_blocked") ||
        route.overrideReason === "generation_blocked")
    ) {
      route = {
        ...route,
        matchedSignals: [
          ...new Set([...route.matchedSignals, "generation_blocked"]),
        ],
      };
      extrasFromRule.setGenerationBlock = true;
    }
    logAiEvent("info", "intent.deterministic", {
      intent: route.intent,
      confidence: route.confidence,
    });
    return {
      route,
      context: builtCtx,
      extras: extrasFromRule,
      classifierMeta,
    };
  }

  // 4–5 (cont). Legacy deterministic (role pairs, prefs, greeting leftovers)
  const legacyDet = mapDeterministicLegacy(text, memory);
  if (legacyDet) {
    const route = applyIntentOverrides(legacyDet.route, builtCtx);
    logAiEvent("info", "intent.deterministic", {
      intent: route.intent,
      confidence: route.confidence,
    });
    return {
      route,
      context: builtCtx,
      extras: legacyDet.extras,
      classifierMeta,
    };
  }

  // 9. Open-concept collaboration (Phase A)
  const openConcept = detectOpenConcept(text);
  if (openConcept.matched) {
    const route = applyIntentOverrides(
      {
        intent: "brainstorm",
        confidence: 0.94,
        source: "deterministic",
        aiRequired: openConcept.kind !== "two_characters",
        creativeGeneration: false,
        needsMemory: true,
        needsDraft: false,
        needsStorySearch: false,
        needsClarification: false,
        clarificationReason: null,
        matchedSignals: ["open_concept", openConcept.kind],
        entities: emptyEntities(),
      },
      builtCtx
    );
    return {
      route,
      context: builtCtx,
      extras: {
        collaborationMode: true,
        openConcept,
      },
      classifierMeta,
    };
  }

  // 10. Contextual scoring (high enough to accept without LLM)
  const contextual = scoreContextualIntent(text, builtCtx);
  if (contextual && contextual.confidence >= threshold) {
    const route = applyIntentOverrides(contextual, builtCtx);
    logAiEvent("info", "intent.contextual", {
      intent: route.intent,
      confidence: route.confidence,
    });
    return {
      route,
      context: builtCtx,
      extras: {},
      classifierMeta,
    };
  }

  // Soft candidate kept for async LLM / fallback
  const softCandidate = contextual
    ? applyIntentOverrides(contextual, builtCtx)
    : ruleMatch
      ? applyIntentOverrides(
          toRouteResultFromMatch(ruleMatch, "deterministic"),
          builtCtx
        )
      : null;

  // Legacy intent router as sync fallback
  const legacy = mapLegacyIntentRouter(text, memory, builtCtx);
  if (legacy.confidence >= threshold) {
    const isBrainstorm = legacy.intent === "brainstorm";
    return {
      route: legacy,
      context: builtCtx,
      extras: isBrainstorm
        ? {
            collaborationMode: true,
            openConcept: {
              matched: true,
              kind: "help_create",
              genreHints: [],
              topicLabel: text.slice(0, 80),
              preferOfferType: "openings",
            },
          }
        : {},
      classifierMeta,
    };
  }

  const route = applyIntentOverrides(
    softCandidate ?? fallbackNormalChat(["sync_fallback"], "fallback"),
    builtCtx
  );
  // Mark low-confidence so async path may still try LLM
  const needsLlm =
    route.confidence < threshold &&
    route.source !== "deterministic" &&
    route.source !== "offer_resolver";

  logAiEvent("info", "intent.fallback", {
    intent: route.intent,
    confidence: route.confidence,
    needsLlm,
  });

  return {
    route: {
      ...route,
      matchedSignals: needsLlm
        ? [...route.matchedSignals, "needs_llm_classifier"]
        : route.matchedSignals,
    },
    context: builtCtx,
    extras: {},
    classifierMeta,
  };
}

/**
 * Full hybrid router including optional LLM classifier for low-confidence cases.
 */
export async function routeStoryIntent(params: {
  userMessage: string;
  memory?: StoryMemory | null;
  flow?: ConversationFlow | null;
  storyId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  turnRequestId?: string;
  skipClassifier?: boolean;
}): Promise<UnifiedRouteResult> {
  const sync = routeStoryIntentSync(params);
  const threshold = getIntentConfidenceThreshold();

  const shouldAttemptClassifier =
    isIntentClassifierEnabled() &&
    !params.skipClassifier &&
    !sync.extras.offerResolution &&
    !sync.extras.awaitingResolution &&
    !sync.extras.clearGenerationBlock &&
    sync.route.source !== "deterministic" &&
    sync.route.source !== "offer_resolver" &&
    sync.route.intent !== "block_generation" &&
    sync.route.intent !== "unblock_generation" &&
    sync.route.intent !== "greeting" &&
    sync.route.intent !== "language_change" &&
    sync.route.intent !== "memory_correction" &&
    !sync.route.matchedSignals.includes("open_concept") &&
    sync.route.confidence < threshold;

  if (!shouldAttemptClassifier) {
    return sync;
  }

  const classified = unwrapClassifier(
    await classifyIntentWithLlm({
      userMessage: params.userMessage,
      context: sync.context,
      turnRequestId: params.turnRequestId,
    })
  );

  if (!classified.result) {
    logAiEvent("info", "intent.fallback", {
      requestId: params.turnRequestId,
      reason: classified.meta.code || "classifier_failed",
      deterministicCandidate: sync.route.intent,
      deterministicConfidence: sync.route.confidence,
    });
    return {
      ...sync,
      classifierMeta: {
        ...classified.meta,
        attempted: true,
        ok: false,
      },
    };
  }

  let route = applyIntentOverrides(classified.result, sync.context);
  if (route.overrideReason) {
    logAiEvent("info", "intent.override", {
      requestId: params.turnRequestId,
      intent: route.intent,
      overrideReason: route.overrideReason,
    });
  }

  route = { ...route, classifierReason: null };

  return {
    route,
    context: sync.context,
    extras: sync.extras,
    classifierMeta: classified.meta,
  };
}
