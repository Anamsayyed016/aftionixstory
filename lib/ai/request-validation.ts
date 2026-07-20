/**
 * Pre-provider request shape validation.
 * Catches known bad parameters before they hit OpenAI/Gemini.
 */

import type { ReasoningEffort } from "@/lib/ai/types";
import type { AiProviderLive } from "@/lib/env";

export type RequestValidationResult =
  | { ok: true }
  | { ok: false; code: "REQUEST_PARAMETER_INVALID"; message: string };

function isOpenAIModelId(model: string): boolean {
  return /^(gpt-|o[0-9]|chatgpt-|text-embedding)/i.test(model);
}

function isGeminiModelId(model: string): boolean {
  return /^gemini-/i.test(model) || model === "mock";
}

function supportsReasoningEffort(model: string): boolean {
  return /^gpt-5/i.test(model) || /^o[0-9]/i.test(model);
}

/**
 * Validate generateText inputs for the selected provider/model.
 * Does not call the network.
 */
export function validateGenerateTextRequest(params: {
  provider: AiProviderLive | "mock";
  model: string;
  systemInstruction: string;
  prompt: string;
  outputMode?: "text" | "json";
  reasoningEffort?: ReasoningEffort;
  maxOutputTokens?: number;
}): RequestValidationResult {
  const model = params.model?.trim() || "";
  if (!model) {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "Selected model is empty.",
    };
  }

  if (!params.prompt?.trim() && !params.systemInstruction?.trim()) {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "Prompt is empty.",
    };
  }

  if (params.provider === "openai" && !isOpenAIModelId(model)) {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "Model id is not valid for OpenAI.",
    };
  }

  if (params.provider === "gemini" && !isGeminiModelId(model)) {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "Model id is not valid for Gemini.",
    };
  }

  if (
    params.reasoningEffort &&
    params.provider === "openai" &&
    !supportsReasoningEffort(model)
  ) {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "Reasoning effort is not supported by the selected model.",
    };
  }

  if (
    typeof params.maxOutputTokens === "number" &&
    (params.maxOutputTokens < 1 || params.maxOutputTokens > 128_000)
  ) {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "maxOutputTokens is out of supported range.",
    };
  }

  // Creative prose must never force JSON at the validation layer —
  // callers set outputMode explicitly; we only reject contradictory empty modes.
  if (params.outputMode && params.outputMode !== "text" && params.outputMode !== "json") {
    return {
      ok: false,
      code: "REQUEST_PARAMETER_INVALID",
      message: "Unsupported output mode.",
    };
  }

  return { ok: true };
}

/** Strip reasoningEffort when the model cannot accept it. */
export function sanitizeReasoningEffort(
  model: string,
  effort?: ReasoningEffort
): ReasoningEffort | undefined {
  if (!effort) return undefined;
  if (!supportsReasoningEffort(model)) return undefined;
  return effort;
}
