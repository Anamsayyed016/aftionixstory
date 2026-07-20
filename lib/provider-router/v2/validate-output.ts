/**
 * Text / JSON output validation (Phase F).
 */

import type { GenerationOutputMode } from "@/lib/provider-router/v2/types";
import { makeProviderError, type ProviderError } from "@/lib/provider-router/v2/errors";

export type TextValidationResult = {
  valid: boolean;
  warnings: string[];
  error?: ProviderError;
};

const PROVIDER_ERROR_TEXT =
  /^(error|exception|traceback|rate limit|api key|unauthorized)\b/i;

export function validateTextOutput(params: {
  text: string;
  operation: string;
  outputMode: GenerationOutputMode;
  finishReason?: string;
}): TextValidationResult {
  const warnings: string[] = [];
  const text = (params.text || "").trim();

  if (!text) {
    return {
      valid: false,
      warnings,
      error: makeProviderError({
        code: "PROVIDER_EMPTY_OUTPUT",
        provider: "unknown",
        retryable: true,
        fallbackAllowed: true,
        message: "Empty provider output",
      }),
    };
  }

  if (PROVIDER_ERROR_TEXT.test(text)) {
    return {
      valid: false,
      warnings,
      error: makeProviderError({
        code: "PROVIDER_UNKNOWN",
        provider: "unknown",
        retryable: true,
        fallbackAllowed: true,
        message: "Provider error text returned as content",
      }),
    };
  }

  if (params.outputMode === "text") {
    const looksJsonOnly =
      (text.startsWith("{") && text.endsWith("}")) ||
      (text.startsWith("[") && text.endsWith("]"));
    const creative =
      /write_scene|revise|episode|creative|story_agent_write/i.test(
        params.operation
      );
    if (creative && looksJsonOnly) {
      return {
        valid: false,
        warnings,
        error: makeProviderError({
          code: "PROVIDER_INVALID_REQUEST",
          provider: "unknown",
          retryable: false,
          fallbackAllowed: true,
          message: "Story prose expected but JSON-only output received",
        }),
      };
    }

    if (/^```/.test(text) && creative) {
      warnings.push("markdown_fence_in_prose");
    }

    if (/as an ai\b|as a language model\b/i.test(text) && creative) {
      warnings.push("meta_introduction");
    }

    if (
      /title\s*\?|genre\s*\?|pov\s*\?|target audience/i.test(text) &&
      creative
    ) {
      return {
        valid: false,
        warnings,
        error: makeProviderError({
          code: "PROVIDER_INVALID_REQUEST",
          provider: "unknown",
          retryable: true,
          fallbackAllowed: true,
          message: "Checklist/wizard response rejected for creative write",
        }),
      };
    }
  }

  if (params.finishReason === "length" || params.finishReason === "max_tokens") {
    warnings.push("truncated");
  }

  return { valid: true, warnings };
}
