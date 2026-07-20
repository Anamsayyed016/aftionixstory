/**
 * LLM intent classifier (Phase B) — optional, low-token, non-fatal.
 */

import "server-only";

import { z } from "zod";

import { buildIntentClassifierPrompt } from "@/lib/ai/prompts/intent-classifier-prompt";
import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import { logAiEvent } from "@/lib/ai/logger";
import type { IntentContext } from "@/lib/conversation-brain/intent-context";
import { generateViaBrain } from "@/lib/conversation-brain/provider-gateway";
import {
  intentEntitiesSchema,
  isCreativeStoryIntent,
  storyIntentSchema,
  type IntentRouteResult,
} from "@/lib/conversation-brain/intents";
import { getAiEnv } from "@/lib/env";
import {
  buildPrompt,
  isPromptRegistryV2Enabled,
  promptResultToLegacyParts,
  resolveTemperature,
  resolveMaxOutputTokens,
  promptLogFieldsForAiEvent,
} from "@/lib/prompt-registry";
import type { DynamicContext } from "@/lib/context-builder/v2/schema";

const classifierOutputSchema = z.object({
  intent: storyIntentSchema,
  confidence: z.number().min(0).max(1),
  entities: intentEntitiesSchema.optional().default({
    characterNames: [],
    episodeNumber: null,
    requestedTone: null,
    requestedLanguage: null,
  }),
  reason: z.string().max(400).optional().default(""),
});

export type ClassifierAttemptMeta = {
  attempted: boolean;
  provider?: string;
  model?: string;
  latencyMs?: number;
  ok: boolean;
  code?: string;
};

export function isIntentClassifierEnabled(): boolean {
  const raw = (process.env.AI_INTENT_CLASSIFIER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getIntentConfidenceThreshold(): number {
  const n = Number(process.env.AI_INTENT_CONFIDENCE_THRESHOLD || "0.55");
  return Number.isFinite(n) ? Math.min(0.95, Math.max(0.3, n)) : 0.55;
}

function classifierTimeoutMs(): number {
  const n = Number(process.env.AI_INTENT_CLASSIFIER_TIMEOUT_MS || "4000");
  return Number.isFinite(n) ? Math.min(15_000, Math.max(1000, n)) : 4000;
}

function classifierModel(): string | undefined {
  const m = (process.env.AI_INTENT_CLASSIFIER_MODEL || "").trim();
  return m || undefined;
}

const DRAFT_REVISE = new Set([
  "rewrite",
  "revise_tone",
  "revise_style",
  "make_emotional",
  "make_romantic",
  "make_funny",
  "shorten",
  "expand",
  "continue_story",
]);

/**
 * One-shot LLM classification. Failures return null (caller falls back).
 */
export async function classifyIntentWithLlm(params: {
  userMessage: string;
  context: IntentContext;
  turnRequestId?: string;
}): Promise<{ result: IntentRouteResult; meta: ClassifierAttemptMeta } | null> {
  if (!isIntentClassifierEnabled()) {
    return null;
  }

  const started = Date.now();
  const ctx = params.context;
  const intentContextSummary = [
    `phase: ${ctx.conversationPhase}`,
    `generationBlocked: ${ctx.generationBlocked}`,
    `hasLatestDraft: ${ctx.hasLatestDraft}`,
    `hasLinkedStory: ${ctx.hasLinkedStory}`,
    `lastIntent: ${ctx.lastIntent || "none"}`,
    `awaiting: ${ctx.awaiting.type}/${ctx.awaiting.topic}`,
    `lastOffers: ${ctx.lastOfferLabels.join(" | ") || "none"}`,
    `recentQuestion: ${ctx.recentAssistantQuestion || "none"}`,
    `recentCharacters: ${ctx.recentCharacterNames.join(", ") || "none"}`,
    `knownCharacters: ${ctx.knownCharacterNames.join(", ") || "none"}`,
    `languagePreference: ${ctx.languagePreference}`,
  ].join("\n");

  let system: string;
  let prompt: string;
  let temperature = 0;
  let maxOutputTokens = 250;

  if (isPromptRegistryV2Enabled()) {
    const emptyCtx: DynamicContext = {
      contextVersion: 2,
      operation: "intent_classifier",
      story: { genre: [], tone: [], themes: [] },
      characters: [],
      relationships: [],
      locations: [],
      objects: [],
      events: [],
      timeline: [],
      openThreads: [],
      secrets: [],
      promises: [],
      worldRules: [],
      writingRules: [],
      preferences: {},
      continuity: {},
      recentConversation: [],
      latestDraft: null,
      recentSummary: null,
      knowledge: { authorKnowledge: [], characterKnowledge: {} },
      instructionContract: null,
      retrieval: {
        includedEntityIds: [],
        excludedCounts: {},
        reasons: [],
        estimatedTokens: 0,
        sectionTokens: {},
        truncated: false,
        truncatedDraft: false,
      },
    };
    const built = buildPrompt({
      promptId: "internal.intent_classifier",
      intent: "unknown",
      operation: "intent_classifier",
      userMessage: params.userMessage,
      context: emptyCtx,
      metadata: { intentContextSummary, turnRequestId: params.turnRequestId },
    });
    const parts = promptResultToLegacyParts(built);
    system = parts.system;
    prompt = parts.prompt;
    temperature = resolveTemperature(built.providerHints.temperatureProfile);
    maxOutputTokens = resolveMaxOutputTokens(
      built.providerHints.maxOutputTokensProfile
    );
    logAiEvent("info", "prompt_registry.build", {
      ...promptLogFieldsForAiEvent(built),
      turnRequestId: params.turnRequestId,
    });
  } else {
    ({ system, prompt } = buildIntentClassifierPrompt({
      userMessage: params.userMessage,
      context: params.context,
    }));
  }

  const env = getAiEnv();
  const timeoutMs = classifierTimeoutMs();
  const model =
    classifierModel() ||
    (env.AI_PROVIDER === "openai"
      ? env.OPENAI_SUMMARY_MODEL || env.OPENAI_AGENT_MODEL
      : env.GEMINI_SUMMARY_MODEL || env.GEMINI_AGENT_MODEL);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let raw: Awaited<ReturnType<typeof generateViaBrain>>;
    try {
      raw = await generateViaBrain({
        turnRequestId: params.turnRequestId,
        modelKind: "agent",
        input: {
          systemInstruction: system,
          prompt,
          temperature,
          maxOutputTokens,
          model,
          operation: "intent_classifier",
          outputMode: "json",
          signal: controller.signal,
        },
      });
    } finally {
      clearTimeout(timer);
    }

    const json = extractJsonObject(raw.text);
    const parsed = classifierOutputSchema.safeParse(json);
    if (!parsed.success) {
      logAiEvent("warn", "intent.llm", {
        requestId: params.turnRequestId,
        code: "STRUCTURED_RESPONSE_INVALID",
        durationMs: Date.now() - started,
        provider: raw.provider,
        model: raw.model,
      });
      return null;
    }

    let intent = parsed.data.intent;
    if (intent === "offer_selection" || intent === "awaiting_answer") {
      intent = "unknown";
    }

    const result: IntentRouteResult = {
      intent,
      confidence: parsed.data.confidence,
      source: "llm",
      aiRequired:
        intent !== "unknown" &&
        intent !== "greeting" &&
        intent !== "block_generation" &&
        intent !== "unblock_generation",
      creativeGeneration: isCreativeStoryIntent(intent),
      needsMemory: true,
      needsDraft: DRAFT_REVISE.has(intent),
      needsStorySearch:
        intent === "search_story" ||
        intent === "episode_question" ||
        intent === "story_question",
      needsClarification: intent === "unknown",
      clarificationReason: intent === "unknown" ? "classifier_uncertain" : null,
      matchedSignals: ["llm_classifier"],
      entities: parsed.data.entities,
      classifierReason: parsed.data.reason || null,
    };

    logAiEvent("info", "intent.llm", {
      requestId: params.turnRequestId,
      code: "OK",
      durationMs: Date.now() - started,
      provider: raw.provider,
      model: raw.model,
      intent: result.intent,
      confidence: result.confidence,
    });

    return {
      result,
      meta: {
        attempted: true,
        provider: raw.provider,
        model: raw.model,
        latencyMs: Date.now() - started,
        ok: true,
      },
    };
  } catch (error) {
    const code =
      error instanceof Error && /abort/i.test(error.message)
        ? "PROVIDER_TIMEOUT"
        : "PROVIDER_UNAVAILABLE";
    logAiEvent("warn", "intent.llm", {
      requestId: params.turnRequestId,
      code,
      durationMs: Date.now() - started,
    });
    return null;
  }
}

export function unwrapClassifier(
  out: { result: IntentRouteResult; meta: ClassifierAttemptMeta } | null
): { result: IntentRouteResult | null; meta: ClassifierAttemptMeta } {
  if (!out) {
    return { result: null, meta: { attempted: true, ok: false } };
  }
  return { result: out.result, meta: out.meta };
}
