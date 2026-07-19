import "server-only";

import { AIError, isAIError, normalizeProviderError } from "@/lib/ai/errors";
import { logAiProviderFailure } from "@/lib/ai/logger";
import { withRetry } from "@/lib/ai/retry";
import { withTimeout } from "@/lib/ai/timeout";
import { estimateTokensFromCharacters } from "@/lib/ai/token-estimator";
import type { AIProvider, GenerateTextInput, GenerateTextResult } from "@/lib/ai/types";
import { getAiEnv } from "@/lib/env";
import { wantsJsonOutput, cleanProviderText } from "@/lib/ai/providers/openai";

function newRequestId() {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * OpenAI-compatible local / self-hosted inference (vLLM, Ollama gateway, llama.cpp, etc.).
 * Business logic stays provider-agnostic — flip AI_PROVIDER=local.
 */
export class LocalAIProvider implements AIProvider {
  readonly name = "local";

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const env = getAiEnv();
    const baseUrl = (env.LOCAL_AI_BASE_URL || "").replace(/\/$/, "");
    if (!baseUrl) {
      throw new AIError(
        "AI_NOT_CONFIGURED",
        "LOCAL_AI_BASE_URL is not configured.",
        false
      );
    }

    const model =
      input.model?.trim() ||
      env.LOCAL_AI_CREATIVE_MODEL ||
      env.LOCAL_AI_AGENT_MODEL ||
      "local-model";
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
            this.callLocal({
              baseUrl,
              apiKey: env.LOCAL_AI_API_KEY || "",
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

      return {
        text: trimmed,
        provider: this.name,
        model,
        durationMs: Date.now() - started,
        inputCharacters,
        outputCharacters: trimmed.length,
        estimatedInputTokens: estimateTokensFromCharacters(inputCharacters),
        estimatedOutputTokens: estimateTokensFromCharacters(trimmed.length),
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

  private async callLocal(params: {
    baseUrl: string;
    apiKey: string;
    model: string;
    input: GenerateTextInput;
    asJson: boolean;
  }): Promise<{ text: string; finishReason: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (params.apiKey.trim()) {
      headers.Authorization = `Bearer ${params.apiKey.trim()}`;
    }

    const body: Record<string, unknown> = {
      model: params.model,
      messages: [
        { role: "system", content: params.input.systemInstruction },
        { role: "user", content: params.input.prompt },
      ],
      temperature: params.input.temperature ?? 0.7,
      max_tokens: params.input.maxOutputTokens ?? 2048,
    };
    if (params.asJson) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: params.input.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw normalizeProviderError({
        status: res.status,
        message: errText || `Local AI HTTP ${res.status}`,
      });
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
        finish_reason?: string | null;
      }>;
    };
    const choice = json.choices?.[0];
    return {
      text: typeof choice?.message?.content === "string" ? choice.message.content : "",
      finishReason: choice?.finish_reason
        ? String(choice.finish_reason)
        : "stop",
    };
  }
}
