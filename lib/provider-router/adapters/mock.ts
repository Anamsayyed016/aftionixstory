/**
 * Mock adapter for tests (Phase F).
 */

import type { ProviderId } from "@/lib/provider-router/v2/capabilities";
import { makeProviderError } from "@/lib/provider-router/v2/errors";
import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderRawResult,
} from "@/lib/provider-router/v2/types";

export type MockAdapterBehavior =
  | { type: "success"; text: string; finishReason?: string; latencyMs?: number }
  | { type: "timeout" }
  | { type: "rate_limit" }
  | { type: "auth" }
  | { type: "empty" }
  | { type: "malformed_json" }
  | { type: "truncated_text"; text: string; latencyMs?: number }
  | { type: "truncated_json"; text: string; latencyMs?: number };

export function createMockAdapter(params: {
  id?: ProviderId;
  configured?: boolean;
  behavior: MockAdapterBehavior | (() => MockAdapterBehavior);
  capabilities?: ProviderCapability[];
}): ProviderAdapter {
  const id = (params.id || "mock") as ProviderId;
  const caps = new Set<ProviderCapability>(
    params.capabilities || [
      "text",
      "json",
      "long_output",
      "low_latency",
      "deterministic",
      "creative",
    ]
  );

  return {
    id,
    isConfigured() {
      return params.configured !== false;
    },
    supports(capability) {
      return caps.has(capability);
    },
    async generate(input, signal): Promise<ProviderRawResult> {
      if (signal?.aborted) {
        throw makeProviderError({
          code: "PROVIDER_TIMEOUT",
          provider: id,
          retryable: true,
          fallbackAllowed: true,
          message: "Aborted",
        });
      }
      const behavior =
        typeof params.behavior === "function"
          ? params.behavior()
          : params.behavior;

      if (behavior.type === "timeout") {
        throw makeProviderError({
          code: "PROVIDER_TIMEOUT",
          provider: id,
          retryable: true,
          fallbackAllowed: true,
          message: "Mock timeout",
        });
      }
      if (behavior.type === "rate_limit") {
        throw makeProviderError({
          code: "PROVIDER_RATE_LIMITED",
          provider: id,
          retryable: true,
          fallbackAllowed: true,
          message: "Mock rate limit",
        });
      }
      if (behavior.type === "auth") {
        throw makeProviderError({
          code: "PROVIDER_AUTH_FAILED",
          provider: id,
          retryable: false,
          fallbackAllowed: true,
          message: "Mock auth failure",
        });
      }
      if (behavior.type === "empty") {
        return {
          text: "",
          model: "mock",
          finishReason: "stop",
          durationMs: 1,
          usage: {
            inputTokens: 1,
            outputTokens: 0,
            totalTokens: 1,
            estimated: true,
          },
        };
      }
      if (behavior.type === "malformed_json") {
        return {
          text: "{not-json",
          model: "mock",
          finishReason: "stop",
          durationMs: 1,
          usage: {
            inputTokens: 1,
            outputTokens: 5,
            totalTokens: 6,
            estimated: true,
          },
        };
      }
      if (behavior.type === "truncated_json") {
        return {
          text: behavior.text,
          model: "mock",
          finishReason: "length",
          durationMs: behavior.latencyMs ?? 1,
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            totalTokens: 20,
            estimated: true,
          },
        };
      }
      if (behavior.type === "truncated_text") {
        return {
          text: behavior.text,
          model: "mock",
          finishReason: "length",
          durationMs: 1,
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            totalTokens: 20,
            estimated: true,
          },
        };
      }

      void input;
      await new Promise((r) => setTimeout(r, behavior.latencyMs ?? 0));
      return {
        text: behavior.text,
        model: "mock",
        finishReason: behavior.finishReason || "stop",
        durationMs: behavior.latencyMs ?? 1,
        usage: {
          inputTokens: 10,
          outputTokens: Math.ceil(behavior.text.length / 4),
          totalTokens: 10 + Math.ceil(behavior.text.length / 4),
          estimated: true,
        },
      };
    },
    normalizeError(error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        "retryable" in error
      ) {
        return error as ReturnType<typeof makeProviderError>;
      }
      return makeProviderError({
        code: "PROVIDER_UNKNOWN",
        provider: id,
        retryable: true,
        fallbackAllowed: true,
        message: error instanceof Error ? error.message : "unknown",
      });
    },
  };
}
