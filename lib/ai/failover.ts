/**
 * Controlled primary → fallback provider failover.
 * Never fans out to both providers in parallel.
 */

import "server-only";

import {
  canAttemptProvider,
  getCircuitSnapshot,
  recordProviderNonTransientFailure,
  recordProviderSuccess,
  recordProviderTransientFailure,
} from "@/lib/ai/circuit-breaker";
import { AIError, isAIError, normalizeProviderError } from "@/lib/ai/errors";
import { logAiEvent } from "@/lib/ai/logger";
import { getAIProvider } from "@/lib/ai/registry";
import { validateGenerateTextRequest } from "@/lib/ai/request-validation";
import type {
  AIProvider,
  AIProviderName,
  GenerateTextInput,
  GenerateTextResult,
} from "@/lib/ai/types";
import {
  getAiEnv,
  resolveAgentModelForProvider,
  resolveCreativeModelForProvider,
  resolveFailoverProviders,
  resolveStoryModelForProvider,
  type AiProviderLive,
} from "@/lib/env";
import { StoryAgentError } from "@/lib/story-agent/errors";
import {
  buildGenerationRequestFromSystemPrompt,
  generate as gatewayGenerate,
  generationResultToLegacyText,
  isProviderError,
  isProviderRouterV2Enabled,
  userFacingGenerationMessage,
} from "@/lib/provider-router/v2";

export type FailoverModelKind = "agent" | "creative" | "story";

function modelFor(
  provider: AiProviderLive,
  kind: FailoverModelKind
): string {
  if (kind === "creative") return resolveCreativeModelForProvider(provider);
  if (kind === "agent") return resolveAgentModelForProvider(provider);
  return resolveStoryModelForProvider(provider);
}

/** Transient failures eligible for one fallback hop. */
export function isTransientFailoverError(error: AIError): boolean {
  if (!error.retryable) return false;
  switch (error.code) {
    case "AI_TIMEOUT":
    case "AI_RATE_LIMITED":
    case "AI_PROVIDER_UNAVAILABLE":
    case "AI_REQUEST_FAILED":
      return true;
    case "AI_QUOTA_EXCEEDED":
    case "AI_NOT_CONFIGURED":
    case "AI_INVALID_MODEL":
    case "AI_CONTENT_BLOCKED":
    case "AI_INVALID_RESPONSE":
      return false;
    default:
      return false;
  }
}

function mapToStoryCode(error: AIError): string {
  switch (error.code) {
    case "AI_TIMEOUT":
      return "PROVIDER_TIMEOUT";
    case "AI_RATE_LIMITED":
      return "PROVIDER_RATE_LIMITED";
    case "AI_QUOTA_EXCEEDED":
      return "PROVIDER_QUOTA_EXCEEDED";
    case "AI_NOT_CONFIGURED":
      return "PROVIDER_AUTH_FAILED";
    case "AI_INVALID_MODEL":
      return "MODEL_UNAVAILABLE";
    case "AI_PROVIDER_UNAVAILABLE":
      return "PROVIDER_UNAVAILABLE";
    case "AI_INVALID_RESPONSE":
      return "STRUCTURED_RESPONSE_INVALID";
    default:
      return "PROVIDER_UNAVAILABLE";
  }
}

async function callProvider(params: {
  providerName: AiProviderLive | "mock";
  modelKind: FailoverModelKind;
  input: Omit<GenerateTextInput, "model"> & { model?: string };
  providerOverride?: AIProvider;
  attempt: number;
  turnRequestId?: string;
}): Promise<GenerateTextResult> {
  const provider =
    params.providerOverride ??
    getAIProvider(params.providerName as AIProviderName);
  const resolvedModel =
    params.input.model?.trim() ||
    (params.providerName === "mock"
      ? "mock"
      : modelFor(params.providerName, params.modelKind));

  const validation = validateGenerateTextRequest({
    provider: params.providerName,
    model: resolvedModel,
    systemInstruction: params.input.systemInstruction,
    prompt: params.input.prompt,
    outputMode: params.input.outputMode,
    reasoningEffort: params.input.reasoningEffort,
    maxOutputTokens: params.input.maxOutputTokens,
  });
  if (!validation.ok) {
    throw new StoryAgentError(
      "REQUEST_PARAMETER_INVALID",
      validation.message,
      { retryable: false, operation: params.input.operation }
    );
  }

  if (
    params.providerName !== "mock" &&
    !canAttemptProvider(params.providerName, resolvedModel)
  ) {
    const snap = getCircuitSnapshot(params.providerName, resolvedModel);
    throw new AIError(
      "AI_PROVIDER_UNAVAILABLE",
      `Provider circuit is ${snap.state}; skipping temporarily.`,
      true
    );
  }

  const started = Date.now();
  try {
    const result = await provider.generateText({
      ...params.input,
      model: resolvedModel,
    });
    if (params.providerName !== "mock") {
      recordProviderSuccess(params.providerName, resolvedModel);
    }
    logAiEvent("info", "ai.failover.attempt", {
      provider: params.providerName,
      model: resolvedModel,
      providerAttempt: params.attempt,
      durationMs: Date.now() - started,
      circuitState:
        params.providerName === "mock"
          ? "CLOSED"
          : getCircuitSnapshot(params.providerName, resolvedModel).state,
      requestId: params.turnRequestId,
      operation: params.input.operation,
      code: "OK",
    });
    return result;
  } catch (error) {
    const normalized = isAIError(error)
      ? error
      : error instanceof StoryAgentError
        ? error
        : normalizeProviderError(error);

    if (normalized instanceof StoryAgentError) {
      throw normalized;
    }

    if (params.providerName !== "mock") {
      if (isTransientFailoverError(normalized)) {
        recordProviderTransientFailure(params.providerName, resolvedModel);
      } else {
        recordProviderNonTransientFailure(params.providerName, resolvedModel);
      }
    }

    logAiEvent("warn", "ai.failover.attempt", {
      provider: params.providerName,
      model: resolvedModel,
      providerAttempt: params.attempt,
      durationMs: Date.now() - started,
      httpStatus: normalized.status,
      circuitState:
        params.providerName === "mock"
          ? "CLOSED"
          : getCircuitSnapshot(params.providerName, resolvedModel).state,
      requestId: params.turnRequestId,
      operation: params.input.operation,
      code: normalized.code,
    });

    throw normalized;
  }
}

/**
 * Call primary provider; on transient failure, call fallback once.
 * Does not failover for invalid params, auth, schema bugs, or quota on both.
 *
 * Phase F: when AI_PROVIDER_ROUTER_V2_ENABLED (and no override), uses unified gateway.
 */
export async function generateWithFailover(params: {
  input: Omit<GenerateTextInput, "model"> & { model?: string };
  modelKind?: FailoverModelKind;
  /** Test injection — skips real providers. */
  providerOverride?: AIProvider;
  turnRequestId?: string;
  conversationId?: string;
}): Promise<GenerateTextResult & { failoverUsed: boolean }> {
  const modelKind = params.modelKind ?? "agent";

  // Phase F unified gateway (skip for test overrides / explicit legacy)
  if (!params.providerOverride && isProviderRouterV2Enabled()) {
    try {
      const request = buildGenerationRequestFromSystemPrompt({
        system: params.input.systemInstruction,
        prompt: params.input.prompt,
        operation: params.input.operation || `failover_${modelKind}`,
        outputMode: params.input.outputMode,
        turnRequestId: params.turnRequestId,
        conversationId: params.conversationId,
        temperature: params.input.temperature,
        maxOutputTokens: params.input.maxOutputTokens,
        modelKind,
      });
      const result = await gatewayGenerate(request, {
        parentSignal: params.input.signal,
      });
      return generationResultToLegacyText(result);
    } catch (error) {
      if (isProviderError(error)) {
        throw new StoryAgentError(
          error.code === "PROVIDER_TIMEOUT"
            ? "PROVIDER_TIMEOUT"
            : error.code === "PROVIDER_RATE_LIMITED"
              ? "PROVIDER_RATE_LIMITED"
              : error.code === "PROVIDER_AUTH_FAILED" ||
                  error.code === "PROVIDER_NOT_CONFIGURED"
                ? "PROVIDER_AUTH_FAILED"
                : "ALL_PROVIDERS_FAILED",
          userFacingGenerationMessage(params.input.operation || "generate"),
          {
            retryable: error.retryable,
            operation: params.input.operation,
          }
        );
      }
      throw error;
    }
  }

  const env = getAiEnv();

  if (params.providerOverride) {
    const result = await callProvider({
      providerName: (params.providerOverride.name as AiProviderLive) || "mock",
      modelKind,
      input: params.input,
      providerOverride: params.providerOverride,
      attempt: 1,
      turnRequestId: params.turnRequestId,
    });
    return { ...result, failoverUsed: false };
  }

  if (env.AI_PROVIDER === "mock") {
    const result = await callProvider({
      providerName: "mock",
      modelKind,
      input: params.input,
      attempt: 1,
      turnRequestId: params.turnRequestId,
    });
    return { ...result, failoverUsed: false };
  }

  const { primary, fallback } = resolveFailoverProviders(env);
  let primaryError: AIError | StoryAgentError | null = null;

  try {
    const result = await callProvider({
      providerName: primary,
      modelKind,
      input: params.input,
      attempt: 1,
      turnRequestId: params.turnRequestId,
    });
    return { ...result, failoverUsed: false };
  } catch (error) {
    if (error instanceof StoryAgentError) {
      // Our validation / request shape — never failover
      throw error;
    }
    const normalized = isAIError(error)
      ? error
      : normalizeProviderError(error);
    primaryError = normalized;

    if (!fallback || !isTransientFailoverError(normalized)) {
      throw normalized;
    }
  }

  try {
    const result = await callProvider({
      providerName: fallback!,
      modelKind,
      input: params.input,
      attempt: 2,
      turnRequestId: params.turnRequestId,
    });
    logAiEvent("info", "ai.failover.success", {
      primaryProvider: primary,
      fallbackProvider: fallback,
      operation: params.input.operation,
      requestId: params.turnRequestId,
      code: "OK",
    });
    return { ...result, failoverUsed: true };
  } catch (error) {
    const fallbackError = isAIError(error)
      ? error
      : error instanceof StoryAgentError
        ? error
        : normalizeProviderError(error);

    logAiEvent("error", "ai.failover.all_failed", {
      primaryProvider: primary,
      fallbackProvider: fallback,
      operation: params.input.operation,
      requestId: params.turnRequestId,
      code: "ALL_PROVIDERS_FAILED",
      primaryCode: primaryError instanceof AIError ? primaryError.code : undefined,
      fallbackCode:
        fallbackError instanceof AIError
          ? fallbackError.code
          : fallbackError instanceof StoryAgentError
            ? fallbackError.code
            : "UNKNOWN",
    });

    if (fallbackError instanceof StoryAgentError) throw fallbackError;

    throw new StoryAgentError(
      "ALL_PROVIDERS_FAILED",
      fallbackError.message ||
        (primaryError instanceof AIError ? primaryError.message : "") ||
        "All AI providers failed.",
      {
        retryable: isTransientFailoverError(
          fallbackError instanceof AIError
            ? fallbackError
            : new AIError("AI_REQUEST_FAILED", "failed", true)
        ),
        operation: params.input.operation,
      }
    );
  }
}

export { mapToStoryCode };
