/**
 * Gemini adapter — wraps existing GeminiProvider (sole SDK boundary).
 */

import { isAIError, normalizeProviderError } from "@/lib/ai/errors";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { isProviderKeyPresent } from "@/lib/env";
import type { PromptMessage } from "@/lib/prompt-registry/types";
import type { ProviderId } from "@/lib/provider-router/v2/capabilities";
import {
  fromAiErrorCode,
  makeProviderError,
  type ProviderError,
} from "@/lib/provider-router/v2/errors";
import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderRawResult,
} from "@/lib/provider-router/v2/types";

function messagesToParts(messages: PromptMessage[]): {
  systemInstruction: string;
  prompt: string;
} {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const prompt = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join("\n\n");
  return {
    systemInstruction: system,
    prompt: prompt || messages.at(-1)?.content || "",
  };
}

export function createGeminiAdapter(
  providerInstance?: GeminiProvider
): ProviderAdapter {
  const provider = providerInstance ?? new GeminiProvider();
  return {
    id: "gemini" as ProviderId,
    isConfigured() {
      return isProviderKeyPresent("gemini");
    },
    supports(capability: ProviderCapability) {
      switch (capability) {
        case "text":
        case "json":
        case "long_output":
        case "low_latency":
        case "deterministic":
        case "creative":
          return true;
        case "streaming_future":
          return false;
        default:
          return false;
      }
    },
    async generate(input, signal): Promise<ProviderRawResult> {
      const parts = messagesToParts(input.messages);
      const result = await provider.generateText({
        systemInstruction: parts.systemInstruction,
        prompt: parts.prompt,
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        model: input.model,
        operation: input.operation,
        outputMode: input.outputMode,
        reasoningEffort: input.reasoningEffort,
        signal: signal || input.signal,
      });
      return {
        text: result.text,
        model: result.model,
        finishReason: result.finishReason || "stop",
        durationMs: result.durationMs,
        requestId: result.requestId,
        usage: {
          inputTokens: result.estimatedInputTokens ?? null,
          outputTokens: result.estimatedOutputTokens ?? null,
          totalTokens:
            result.estimatedInputTokens != null &&
            result.estimatedOutputTokens != null
              ? result.estimatedInputTokens + result.estimatedOutputTokens
              : null,
          estimated: true,
        },
      };
    },
    normalizeError(error: unknown): ProviderError {
      if (isAIError(error)) {
        const mapped = fromAiErrorCode(error.code);
        return makeProviderError({
          code: mapped.code,
          provider: "gemini",
          retryable: mapped.retryable,
          fallbackAllowed: mapped.fallbackAllowed,
          message: error.message,
          statusCode: error.status ?? null,
        });
      }
      const normalized = normalizeProviderError(error);
      const mapped = fromAiErrorCode(normalized.code);
      return makeProviderError({
        code: mapped.code,
        provider: "gemini",
        retryable: mapped.retryable,
        fallbackAllowed: mapped.fallbackAllowed,
        message: normalized.message,
        statusCode: normalized.status ?? null,
      });
    },
  };
}
