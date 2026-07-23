import "server-only";

import OpenAI from "openai";

import { AIError, isAIError, normalizeProviderError } from "@/lib/ai/errors";
import { logAiProviderFailure } from "@/lib/ai/logger";
import { withRetry } from "@/lib/ai/retry";
import { withTimeout } from "@/lib/ai/timeout";
import { estimateTokensFromCharacters } from "@/lib/ai/token-estimator";
import type { AIProvider, GenerateTextInput, GenerateTextResult } from "@/lib/ai/types";
import { getAiEnv, resolveStoryModel } from "@/lib/env";

function newRequestId() {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** True when the caller expects a JSON object (e.g. Phase 2 chat extraction). */
export function wantsJsonOutput(input: GenerateTextInput): boolean {
  if (input.outputMode === "text") return false;
  if (input.outputMode === "json") return true;
  const haystack = `${input.systemInstruction}\n${input.prompt}`;
  return /\bjson\b/i.test(haystack);
}

/** Strip accidental markdown fences; prefer raw JSON text for parsers. */
export function cleanProviderText(text: string, asJson: boolean): string {
  const trimmed = text.trim();
  if (!asJson) return trimmed;
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function isOpenAIModelId(model: string): boolean {
  return /^(gpt-|o[0-9]|chatgpt-|text-embedding)/i.test(model);
}

/**
 * GPT-5 / o-series currently reject non-default temperature on Chat Completions.
 * Omit the field so the API uses its default (1).
 */
export function supportsCustomTemperature(model: string): boolean {
  if (/^gpt-5/i.test(model)) return false;
  if (/^o[0-9]/i.test(model)) return false;
  return true;
}

export type OpenAIClientLike = {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_completion_tokens?: number;
        reasoning_effort?: "minimal" | "low" | "medium" | "high";
        response_format?: { type: "json_object" | "text" };
      }) => Promise<{
        choices?: Array<{
          message?: { content?: string | null };
          finish_reason?: string | null;
        }>;
      }>;
    };
  };
  /** Optional Responses API surface (web_search). */
  responses?: {
    create: (params: {
      model: string;
      tools?: Array<{ type: string }>;
      input?: Array<{ role: string; content: string }>;
      temperature?: number;
      max_output_tokens?: number;
    }) => Promise<{
      output_text?: string | null;
      output?: unknown;
    }>;
  };
};

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    private readonly createClient: (apiKey: string) => OpenAIClientLike = (
      apiKey
    ) => new OpenAI({ apiKey }) as unknown as OpenAIClientLike
  ) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const env = getAiEnv();
    if (!env.OPENAI_API_KEY.trim()) {
      throw new AIError(
        "AI_NOT_CONFIGURED",
        "OPENAI_API_KEY is not configured.",
        false
      );
    }

    const requested = input.model?.trim();
    const model =
      requested && isOpenAIModelId(requested)
        ? requested
        : resolveStoryModel(env);
    const started = Date.now();
    const requestId = newRequestId();
    const operation = input.operation || "generate_text";
    let attempts = 0;
    const inputCharacters =
      input.systemInstruction.length + input.prompt.length;
    const asJson = wantsJsonOutput(input);

    try {
      const raw = await withRetry(
        async () => {
          attempts += 1;
          return withTimeout(
            this.callOpenAI({
              apiKey: env.OPENAI_API_KEY,
              model,
              input,
              asJson,
            }),
            env.AI_REQUEST_TIMEOUT_MS,
            input.signal
          );
        },
        { maxRetries: env.AI_MAX_RETRIES }
      );

      const trimmed = cleanProviderText(raw.text, asJson);
      if (!trimmed) {
        throw new AIError(
          "AI_INVALID_RESPONSE",
          "The AI provider returned an empty response.",
          false
        );
      }

      const durationMs = Date.now() - started;
      const outputCharacters = trimmed.length;

      return {
        text: trimmed,
        provider: this.name,
        model,
        durationMs,
        inputCharacters,
        outputCharacters,
        estimatedInputTokens: estimateTokensFromCharacters(inputCharacters),
        estimatedOutputTokens: estimateTokensFromCharacters(outputCharacters),
        requestId,
        finishReason: raw.finishReason,
      };
    } catch (error) {
      const normalized = isAIError(error) ? error : normalizeProviderError(error);
      logAiProviderFailure({
        requestId,
        provider: this.name,
        model,
        code: normalized.code,
        httpStatus: normalized.status,
        retryCount: Math.max(0, attempts - 1),
        durationMs: Date.now() - started,
        operation,
      });
      throw normalized;
    }
  }

  private async callOpenAI(params: {
    apiKey: string;
    model: string;
    input: GenerateTextInput;
    asJson: boolean;
  }): Promise<{ text: string; finishReason: string }> {
    const client = this.createClient(params.apiKey);
    const maxCompletionTokens = params.input.maxOutputTokens ?? 4096;

    try {
      // Native web_search requires the Responses API (not Chat Completions).
      if (params.input.enableWebSearch) {
        if (!client.responses?.create) {
          throw new AIError(
            "AI_INVALID_RESPONSE",
            "OpenAI client does not expose Responses API for web_search.",
            false
          );
        }
        const response = await client.responses.create({
          model: params.model,
          tools: [{ type: "web_search" }],
          input: [
            { role: "system", content: params.input.systemInstruction },
            { role: "user", content: params.input.prompt },
          ],
          max_output_tokens: maxCompletionTokens,
          ...(supportsCustomTemperature(params.model)
            ? { temperature: params.input.temperature ?? 0.7 }
            : {}),
        });
        const text =
          typeof response.output_text === "string" ? response.output_text : "";
        return { text, finishReason: "stop" };
      }

      const request: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
        max_completion_tokens?: number;
        reasoning_effort?: "minimal" | "low" | "medium" | "high";
        response_format?: { type: "json_object" | "text" };
      } = {
        model: params.model,
        messages: [
          { role: "system", content: params.input.systemInstruction },
          { role: "user", content: params.input.prompt },
        ],
        max_completion_tokens: maxCompletionTokens,
      };

      if (supportsCustomTemperature(params.model)) {
        request.temperature = params.input.temperature ?? 0.9;
      }

      if (params.input.reasoningEffort) {
        request.reasoning_effort = params.input.reasoningEffort;
      }

      if (params.asJson) {
        request.response_format = { type: "json_object" };
      }

      const response = await client.chat.completions.create(request);

      const choice = response.choices?.[0];
      const finishReason = choice?.finish_reason;
      if (
        finishReason &&
        /content_filter|safety/i.test(String(finishReason))
      ) {
        throw new AIError(
          "AI_CONTENT_BLOCKED",
          "The provider blocked this generation for safety policy reasons.",
          false
        );
      }

      const text =
        typeof choice?.message?.content === "string"
          ? choice.message.content
          : "";

      return {
        text,
        finishReason: finishReason ? String(finishReason) : "stop",
      };
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}
