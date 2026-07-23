import "server-only";

import { GoogleGenAI } from "@google/genai";

import { AIError, isAIError, normalizeProviderError } from "@/lib/ai/errors";
import { logAiProviderFailure } from "@/lib/ai/logger";
import { withRetry } from "@/lib/ai/retry";
import { withTimeout } from "@/lib/ai/timeout";
import { estimateTokensFromCharacters } from "@/lib/ai/token-estimator";
import type { AIProvider, GenerateTextInput, GenerateTextResult } from "@/lib/ai/types";
import { getAiEnv } from "@/lib/env";

function newRequestId() {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const env = getAiEnv();
    if (!env.GEMINI_API_KEY) {
      throw new AIError("AI_NOT_CONFIGURED", "GEMINI_API_KEY is not configured.", false);
    }

    const model = input.model || env.GEMINI_STORY_MODEL;
    const started = Date.now();
    const requestId = newRequestId();
    const operation = input.operation || "generate_text";
    let attempts = 0;
    const inputCharacters =
      input.systemInstruction.length + input.prompt.length;

    try {
      const text = await withRetry(
        async () => {
          attempts += 1;
          return withTimeout(
            this.callGemini({
              apiKey: env.GEMINI_API_KEY,
              model,
              input,
            }),
            env.AI_REQUEST_TIMEOUT_MS,
            input.signal
          );
        },
        { maxRetries: env.AI_MAX_RETRIES }
      );

      const trimmed = text.trim();
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

  private async callGemini(params: {
    apiKey: string;
    model: string;
    input: GenerateTextInput;
  }): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: params.apiKey });

    try {
      const response = await ai.models.generateContent({
        model: params.model,
        contents: params.input.prompt,
        config: {
          systemInstruction: params.input.systemInstruction,
          temperature: params.input.temperature ?? 0.9,
          maxOutputTokens: params.input.maxOutputTokens ?? 4096,
          ...(params.input.enableWebSearch
            ? { tools: [{ googleSearch: {} }] }
            : {}),
        },
      });

      const promptFeedback = (
        response as { promptFeedback?: { blockReason?: string } }
      ).promptFeedback;
      if (promptFeedback?.blockReason) {
        throw new AIError(
          "AI_CONTENT_BLOCKED",
          "The provider blocked this generation for safety policy reasons.",
          false
        );
      }

      const candidates = (
        response as {
          candidates?: Array<{
            finishReason?: string;
            content?: { parts?: Array<{ text?: string }> };
          }>;
        }
      ).candidates;
      const finishReason = candidates?.[0]?.finishReason;
      if (
        finishReason &&
        /safety|block|prohibited|recitation/i.test(String(finishReason))
      ) {
        throw new AIError(
          "AI_CONTENT_BLOCKED",
          "The provider blocked this generation for safety policy reasons.",
          false
        );
      }

      const text =
        typeof response.text === "string"
          ? response.text
          : candidates?.[0]?.content?.parts
              ?.map((p) => p.text || "")
              .join("") || "";

      return text;
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}
