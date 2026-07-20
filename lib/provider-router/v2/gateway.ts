/**
 * Unified Generation Gateway (Phase F).
 */

import { randomUUID } from "crypto";
import type { z } from "zod";

import { logAiEvent } from "@/lib/ai/logger";
import type { PromptResult } from "@/lib/prompt-registry/types";
import { defaultHints } from "@/lib/prompt-registry/provider-hints";
import {
  dedupeKey,
  withGenerationDedupe,
} from "@/lib/provider-router/v2/deduplicate";
import {
  isProviderError,
  makeProviderError,
  userFacingGenerationMessage,
  type ProviderError,
} from "@/lib/provider-router/v2/errors";
import { parseProviderJson, validateJsonWithSchema } from "@/lib/provider-router/v2/json-output";
import { summarizeGenerationForLogs } from "@/lib/provider-router/v2/log-summary";
import { resolveModelForProfile } from "@/lib/provider-router/v2/model-profiles";
import { resolveParameterProfiles } from "@/lib/provider-router/v2/parameter-profiles";
import {
  getGenerationPolicy,
  mergePolicyWithRequest,
} from "@/lib/provider-router/v2/policies";
import {
  routerRecordNonTransientFailure,
  routerRecordSuccess,
  routerRecordTransientFailure,
} from "@/lib/provider-router/v2/circuit-breaker";
import { generationRequestSchema } from "@/lib/provider-router/v2/schema";
import { selectProviders } from "@/lib/provider-router/v2/select-provider";
import {
  remainingDeadlineMs,
  withAttemptTimeout,
} from "@/lib/provider-router/v2/timeout";
import type {
  AttemptRecord,
  GenerationPolicy,
  GenerationRequest,
  GenerationResult,
  ProviderAdapter,
} from "@/lib/provider-router/v2/types";
import { validateTextOutput } from "@/lib/provider-router/v2/validate-output";

export type GatewayGenerateOptions = {
  injectAdapters?: ProviderAdapter[];
  jsonSchema?: z.ZodType<unknown>;
  parentSignal?: AbortSignal;
};

function messagesFromLegacy(system: string, prompt: string) {
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: prompt },
  ];
}

export function buildGenerationRequestFromPromptResult(params: {
  promptResult: PromptResult;
  operation: string;
  intent?: string;
  turnRequestId?: string;
  conversationId?: string;
  storyId?: string | null;
  requestId?: string;
  classifier?: boolean;
  modelKind?: "agent" | "creative" | "story";
}): GenerationRequest {
  return {
    requestId: params.requestId || randomUUID(),
    turnRequestId: params.turnRequestId,
    conversationId: params.conversationId,
    operation: params.operation,
    intent: params.intent,
    prompt: {
      promptId: params.promptResult.promptId,
      promptVersion: params.promptResult.promptVersion,
      messages: params.promptResult.messages,
      outputMode: params.promptResult.outputMode,
      providerHints: params.promptResult.providerHints,
    },
    metadata: {
      storyId: params.storyId ?? null,
      classifier: params.classifier,
      modelKind: params.modelKind,
    },
  };
}

export function buildGenerationRequestFromSystemPrompt(params: {
  system: string;
  prompt: string;
  operation: string;
  outputMode?: "text" | "json";
  turnRequestId?: string;
  conversationId?: string;
  promptId?: string;
  promptVersion?: string;
  temperature?: number;
  maxOutputTokens?: number;
  modelKind?: "agent" | "creative" | "story";
  intent?: string;
}): GenerationRequest {
  const outputMode = params.outputMode || "text";
  const temperatureProfile =
    params.temperature === 0
      ? ("deterministic" as const)
      : (params.temperature ?? 0.55) >= 0.75
        ? ("creative" as const)
        : ("balanced" as const);
  const maxOutputTokensProfile =
    (params.maxOutputTokens ?? 1400) >= 6000
      ? ("long_creative" as const)
      : (params.maxOutputTokens ?? 1400) >= 3000
        ? ("long" as const)
        : (params.maxOutputTokens ?? 1400) <= 500
          ? ("short" as const)
          : ("medium" as const);

  return {
    requestId: randomUUID(),
    turnRequestId: params.turnRequestId,
    conversationId: params.conversationId,
    operation: params.operation,
    intent: params.intent,
    prompt: {
      promptId: params.promptId || `legacy.${params.operation}`,
      promptVersion: params.promptVersion || "0.0.0-legacy",
      messages: messagesFromLegacy(params.system, params.prompt),
      outputMode,
      providerHints: defaultHints({
        temperatureProfile,
        maxOutputTokensProfile,
        jsonMode: outputMode === "json",
        reasoningProfile: "none",
      }),
    },
    metadata: { modelKind: params.modelKind },
  };
}

function toError(error: unknown, provider: string): ProviderError {
  if (isProviderError(error)) {
    return { ...error, provider: error.provider || provider };
  }
  if (
    error &&
    typeof error === "object" &&
    "normalizeError" in (error as object)
  ) {
    // shouldn't happen
  }
  return makeProviderError({
    code: "PROVIDER_UNKNOWN",
    provider,
    retryable: true,
    fallbackAllowed: true,
    message: error instanceof Error ? error.message : "Unknown provider error",
  });
}

async function runOnce(params: {
  adapter: ProviderAdapter;
  request: GenerationRequest;
  policy: GenerationPolicy;
  attempt: number;
  timeoutMs: number;
  parentSignal?: AbortSignal;
  jsonSchema?: z.ZodType<unknown>;
  repairPrompt?: string;
}): Promise<{
  result?: GenerationResult;
  error?: ProviderError;
  attempt: AttemptRecord;
  rawText?: string;
}> {
  const started = Date.now();
  const paramsResolved = resolveParameterProfiles({
    temperatureProfile: params.policy.temperatureProfile,
    maxOutputTokensProfile: params.policy.maxOutputTokensProfile,
    reasoningProfile: params.policy.reasoningProfile,
    jsonMode: params.policy.jsonMode,
  });
  const model = resolveModelForProfile(
    params.adapter.id,
    params.policy.modelProfile
  );

  const messages = params.repairPrompt
    ? [
        ...params.request.prompt.messages,
        { role: "user" as const, content: params.repairPrompt },
      ]
    : params.request.prompt.messages;

  try {
    const raw = await withAttemptTimeout(
      params.timeoutMs,
      (signal) =>
        params.adapter.generate(
          {
            messages,
            outputMode: params.request.prompt.outputMode,
            temperature: paramsResolved.temperature,
            maxOutputTokens: paramsResolved.maxOutputTokens,
            model,
            operation: params.request.operation,
            reasoningEffort: paramsResolved.reasoningEffort,
            signal,
          },
          signal
        ),
      params.parentSignal
    );

    routerRecordSuccess(params.adapter.id, model);

    const textValidation = validateTextOutput({
      text: raw.text,
      operation: params.request.operation,
      outputMode: params.request.prompt.outputMode,
      finishReason: raw.finishReason,
    });

    if (!textValidation.valid) {
      const err = textValidation.error!;
      if (err.retryable) {
        routerRecordTransientFailure(params.adapter.id, model);
      } else {
        routerRecordNonTransientFailure(params.adapter.id, model);
      }
      return {
        error: { ...err, provider: params.adapter.id },
        attempt: {
          provider: params.adapter.id,
          attempt: params.attempt,
          success: false,
          latencyMs: Date.now() - started,
          errorCode: err.code,
          retryable: err.retryable,
        },
        rawText: raw.text,
      };
    }

    let json: unknown | null = null;
    if (params.request.prompt.outputMode === "json") {
      const parsed = parseProviderJson(raw.text);
      if (!parsed.ok) {
        routerRecordTransientFailure(params.adapter.id, model);
        return {
          error: { ...parsed.error, provider: params.adapter.id },
          attempt: {
            provider: params.adapter.id,
            attempt: params.attempt,
            success: false,
            latencyMs: Date.now() - started,
            errorCode: parsed.error.code,
            retryable: false,
          },
          rawText: raw.text,
        };
      }
      if (params.jsonSchema) {
        const validated = validateJsonWithSchema(parsed.value, params.jsonSchema);
        if (!validated.ok) {
          return {
            error: { ...validated.error, provider: params.adapter.id },
            attempt: {
              provider: params.adapter.id,
              attempt: params.attempt,
              success: false,
              latencyMs: Date.now() - started,
              errorCode: validated.error.code,
              retryable: false,
            },
            rawText: raw.text,
          };
        }
        json = validated.value;
      } else {
        json = parsed.value;
      }
    }

    const result: GenerationResult = {
      requestId: params.request.requestId,
      provider: params.adapter.id,
      model: raw.model || model,
      outputMode: params.request.prompt.outputMode,
      text: raw.text,
      json,
      finishReason: raw.finishReason || "stop",
      usage: {
        inputTokens: raw.usage?.inputTokens ?? null,
        outputTokens: raw.usage?.outputTokens ?? null,
        totalTokens: raw.usage?.totalTokens ?? null,
        estimated: raw.usage?.estimated ?? true,
      },
      attempts: [
        {
          provider: params.adapter.id,
          attempt: params.attempt,
          success: true,
          latencyMs: Date.now() - started,
          errorCode: null,
          retryable: false,
        },
      ],
      routing: {
        selectedProvider: params.adapter.id,
        fallbackUsed: false,
        fallbackReason: null,
      },
      validation: {
        valid: true,
        repairUsed: Boolean(params.repairPrompt),
        warnings: textValidation.warnings,
      },
      durationMs: Date.now() - started,
      promptId: params.request.prompt.promptId,
      promptVersion: params.request.prompt.promptVersion,
    };

    return {
      result,
      attempt: result.attempts[0],
      rawText: raw.text,
    };
  } catch (error) {
    const normalized = params.adapter.normalizeError
      ? params.adapter.normalizeError(error)
      : toError(error, params.adapter.id);
    const err = { ...normalized, provider: params.adapter.id };
    if (err.retryable) {
      routerRecordTransientFailure(params.adapter.id, model);
    } else {
      routerRecordNonTransientFailure(params.adapter.id, model);
    }
    return {
      error: err,
      attempt: {
        provider: params.adapter.id,
        attempt: params.attempt,
        success: false,
        latencyMs: Date.now() - started,
        errorCode: err.code,
        retryable: err.retryable,
      },
    };
  }
}

async function executeGeneration(
  request: GenerationRequest,
  options: GatewayGenerateOptions = {}
): Promise<GenerationResult> {
  const parsed = generationRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw makeProviderError({
      code: "PROVIDER_INVALID_REQUEST",
      provider: "gateway",
      retryable: false,
      fallbackAllowed: false,
      message: "Invalid GenerationRequest",
    });
  }

  const basePolicy = getGenerationPolicy({
    operation: request.operation,
    intent: request.intent,
    promptId: request.prompt.promptId,
    classifier: request.metadata?.classifier,
    outputMode: request.prompt.outputMode,
  });
  const policy = mergePolicyWithRequest(basePolicy, request);
  const providers = selectProviders({
    policy,
    preferredProvider: request.routing?.preferredProvider,
    allowedProviders: request.routing?.allowedProviders,
    injectAdapters: options.injectAdapters,
  });

  const startedAt = Date.now();
  const attempts: AttemptRecord[] = [];
  let repairUsed = false;
  let lastError: ProviderError | null = null;
  let lastRawText = "";
  let fallbackUsed = false;
  let fallbackReason: string | null = null;
  let totalAttempts = 0;

  logAiEvent("info", "generation.request", {
    requestId: request.requestId,
    turnRequestId: request.turnRequestId || "",
    operation: request.operation,
    promptId: request.prompt.promptId,
    promptVersion: request.prompt.promptVersion,
  });

  if (providers.length === 0) {
    logAiEvent("error", "generation.failure", {
      requestId: request.requestId,
      operation: request.operation,
      errorCode: "PROVIDER_NOT_CONFIGURED",
    });
    throw makeProviderError({
      code: "PROVIDER_NOT_CONFIGURED",
      provider: "gateway",
      retryable: false,
      fallbackAllowed: false,
      message: userFacingGenerationMessage(request.operation),
    });
  }

  for (let pi = 0; pi < providers.length; pi++) {
    const adapter = providers[pi];
    if (pi > 0) {
      if (!policy.fallbackAllowed) break;
      fallbackUsed = true;
      fallbackReason = lastError?.code || "provider_failed";
      logAiEvent("info", "generation.fallback", {
        requestId: request.requestId,
        operation: request.operation,
        selectedProvider: adapter.id,
        errorCode: fallbackReason,
      });
    }

    const perProviderAttempts = policy.retryAllowed
      ? policy.maxAttemptsPerProvider
      : 1;

    for (let attempt = 1; attempt <= perProviderAttempts; attempt++) {
      const remaining = remainingDeadlineMs(startedAt, policy.totalDeadlineMs);
      if (remaining < 200) {
        logAiEvent("warn", "generation.timeout", {
          requestId: request.requestId,
          operation: request.operation,
          errorCode: "PROVIDER_TIMEOUT",
        });
        break;
      }
      if (totalAttempts >= policy.maxTotalAttempts) break;
      totalAttempts += 1;

      if (attempt > 1) {
        logAiEvent("info", "generation.retry", {
          requestId: request.requestId,
          operation: request.operation,
          selectedProvider: adapter.id,
          attemptCount: attempt,
        });
      }

      const timeoutMs = Math.min(policy.timeoutMs, remaining);
      const once = await runOnce({
        adapter,
        request,
        policy,
        attempt,
        timeoutMs,
        parentSignal: options.parentSignal,
        jsonSchema: options.jsonSchema,
      });
      attempts.push(once.attempt);

      if (once.result) {
        once.result.attempts = [...attempts];
        once.result.routing = {
          selectedProvider: adapter.id,
          fallbackUsed,
          fallbackReason,
        };
        once.result.durationMs = Date.now() - startedAt;
        once.result.validation.repairUsed = repairUsed;

        logAiEvent(
          "info",
          "generation.success",
          summarizeGenerationForLogs({
            requestId: request.requestId,
            turnRequestId: request.turnRequestId,
            operation: request.operation,
            promptId: request.prompt.promptId,
            promptVersion: request.prompt.promptVersion,
            selectedProvider: adapter.id,
            modelProfile: policy.modelProfile,
            attemptCount: attempts.length,
            fallbackUsed,
            latencyMs: once.result.durationMs,
            outputMode: request.prompt.outputMode,
            estimatedInputTokens: once.result.usage.inputTokens,
            outputTokens: once.result.usage.outputTokens,
            success: true,
          })
        );
        return once.result;
      }

      lastError = once.error || null;
      lastRawText = once.rawText || lastRawText;

      // JSON repair — one maximum across the logical request
      if (
        !repairUsed &&
        policy.jsonRepairAllowed &&
        request.prompt.outputMode === "json" &&
        lastError?.code === "PROVIDER_MALFORMED_JSON" &&
        lastRawText
      ) {
        repairUsed = true;
        logAiEvent("info", "generation.json_repair", {
          requestId: request.requestId,
          operation: request.operation,
          selectedProvider: adapter.id,
        });
        totalAttempts += 1;
        const repair = await runOnce({
          adapter,
          request,
          policy,
          attempt: attempt + 1,
          timeoutMs: Math.min(policy.timeoutMs, remainingDeadlineMs(startedAt, policy.totalDeadlineMs)),
          parentSignal: options.parentSignal,
          jsonSchema: options.jsonSchema,
          repairPrompt: `STRICT REPAIR: Return valid JSON only. No markdown fences. No commentary.\n\nInvalid previous output:\n${lastRawText.slice(0, 2000)}`,
        });
        attempts.push(repair.attempt);
        if (repair.result) {
          repair.result.attempts = [...attempts];
          repair.result.routing = {
            selectedProvider: adapter.id,
            fallbackUsed,
            fallbackReason,
          };
          repair.result.validation.repairUsed = true;
          repair.result.durationMs = Date.now() - startedAt;
          logAiEvent("info", "generation.success", {
            requestId: request.requestId,
            operation: request.operation,
            selectedProvider: adapter.id,
            success: true,
          });
          return repair.result;
        }
        lastError = repair.error || lastError;
      }

      // Non-retryable on this provider → try fallback
      if (lastError && !lastError.retryable) break;
      // Auth failure: no useless same-provider retry
      if (lastError?.code === "PROVIDER_AUTH_FAILED") break;
      if (lastError?.code === "PROVIDER_NOT_CONFIGURED") break;
    }
  }

  logAiEvent("error", "generation.failure", {
    requestId: request.requestId,
    operation: request.operation,
    errorCode: lastError?.code || "PROVIDER_UNKNOWN",
    attemptCount: attempts.length,
    fallbackUsed,
  });

  throw makeProviderError({
    code: lastError?.code || "PROVIDER_UNKNOWN",
    provider: lastError?.provider || "gateway",
    retryable: Boolean(lastError?.retryable),
    fallbackAllowed: false,
    message: userFacingGenerationMessage(request.operation),
  });
}

/**
 * Primary gateway entry — all active AI generation should use this.
 */
export async function generate(
  request: GenerationRequest,
  options: GatewayGenerateOptions = {}
): Promise<GenerationResult> {
  const key = dedupeKey({
    conversationId: request.conversationId,
    turnRequestId: request.turnRequestId,
    operation: request.operation,
    promptId: request.prompt.promptId,
  });

  const { result, deduplicated } = await withGenerationDedupe(key, () =>
    executeGeneration(request, options)
  );

  if (deduplicated) {
    logAiEvent("info", "generation.deduplicated", {
      requestId: request.requestId,
      turnRequestId: request.turnRequestId || "",
      operation: request.operation,
    });
  }

  return result;
}

export async function generateText(
  request: GenerationRequest,
  options?: GatewayGenerateOptions
): Promise<GenerationResult> {
  return generate(
    {
      ...request,
      prompt: { ...request.prompt, outputMode: "text" },
    },
    options
  );
}

export async function generateJson<T>(
  request: GenerationRequest,
  schema: z.ZodType<T>,
  options?: GatewayGenerateOptions
): Promise<GenerationResult & { json: T }> {
  const result = await generate(
    {
      ...request,
      prompt: { ...request.prompt, outputMode: "json" },
    },
    { ...options, jsonSchema: schema as z.ZodType<unknown> }
  );
  return result as GenerationResult & { json: T };
}

/** Map gateway result → legacy GenerateTextResult shape. */
export function generationResultToLegacyText(result: GenerationResult): {
  text: string;
  provider: string;
  model: string;
  durationMs: number;
  inputCharacters: number;
  outputCharacters: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  requestId?: string;
  finishReason?: string;
  failoverUsed: boolean;
  promptId?: string;
  promptVersion?: string;
} {
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    inputCharacters: Math.round((result.usage.inputTokens || 0) * 4),
    outputCharacters: result.text.length,
    estimatedInputTokens: result.usage.inputTokens ?? undefined,
    estimatedOutputTokens: result.usage.outputTokens ?? undefined,
    requestId: result.requestId,
    finishReason: result.finishReason,
    failoverUsed: result.routing.fallbackUsed,
    promptId: result.promptId,
    promptVersion: result.promptVersion,
  };
}
