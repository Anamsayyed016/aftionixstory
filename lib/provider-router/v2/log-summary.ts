/**
 * Safe generation log summary (Phase F).
 */

import type { GenerationResult } from "@/lib/provider-router/v2/types";

export function summarizeGenerationForLogs(result: {
  requestId: string;
  turnRequestId?: string;
  operation: string;
  promptId: string;
  promptVersion: string;
  selectedProvider: string;
  modelProfile?: string;
  attemptCount: number;
  fallbackUsed: boolean;
  latencyMs: number;
  outputMode: string;
  estimatedInputTokens?: number | null;
  outputTokens?: number | null;
  success: boolean;
  errorCode?: string | null;
  deduplicated?: boolean;
}): Record<string, string | number | boolean> {
  return {
    requestId: result.requestId,
    turnRequestId: result.turnRequestId || "",
    operation: result.operation,
    promptId: result.promptId,
    promptVersion: result.promptVersion,
    selectedProvider: result.selectedProvider,
    modelProfile: result.modelProfile || "",
    attemptCount: result.attemptCount,
    fallbackUsed: result.fallbackUsed,
    latencyMs: result.latencyMs,
    outputMode: result.outputMode,
    estimatedInputTokens: result.estimatedInputTokens ?? 0,
    outputTokens: result.outputTokens ?? 0,
    success: result.success,
    errorCode: result.errorCode || "",
    deduplicated: Boolean(result.deduplicated),
  };
}

export function summarizeResultMeta(result: GenerationResult): Record<
  string,
  string | number | boolean
> {
  return summarizeGenerationForLogs({
    requestId: result.requestId,
    operation: result.promptId,
    promptId: result.promptId,
    promptVersion: result.promptVersion,
    selectedProvider: result.provider,
    attemptCount: result.attempts.length,
    fallbackUsed: result.routing.fallbackUsed,
    latencyMs: result.durationMs,
    outputMode: result.outputMode,
    estimatedInputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    success: result.validation.valid && Boolean(result.text),
    errorCode: null,
  });
}
