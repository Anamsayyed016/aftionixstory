import "server-only";

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import {
  AIError,
  isAIError,
  normalizeProviderError,
  type AIErrorCode,
} from "@/lib/ai/errors";
import { logAiEvent } from "@/lib/ai/logger";
import {
  getAiEnv,
  isActiveAiKeyPresent,
  resolveStoryModel,
  resolveSummaryModel,
} from "@/lib/env";

export type AiHealthStatus =
  | "ok"
  | "not_configured"
  | "quota_exceeded"
  | "auth_failed"
  | "model_not_found"
  | "timeout"
  | "network_error"
  | "provider_error";

export type AiHealthCheckResult = {
  ok: boolean;
  status: AiHealthStatus;
  provider: string;
  storyModel: string;
  summaryModel: string;
  keyPresent: boolean;
  probedModel: string | null;
  httpStatus?: number;
  code?: AIErrorCode;
  durationMs: number;
  message: string;
};

function classifyHealthFailure(error: AIError): AiHealthStatus {
  switch (error.code) {
    case "AI_NOT_CONFIGURED":
      return error.message.toLowerCase().includes("not configured") &&
        !error.status
        ? "not_configured"
        : "auth_failed";
    case "AI_QUOTA_EXCEEDED":
      return "quota_exceeded";
    case "AI_INVALID_MODEL":
      return "model_not_found";
    case "AI_TIMEOUT":
      return "timeout";
    case "AI_REQUEST_FAILED":
      return "network_error";
    default:
      return "provider_error";
  }
}

/**
 * Configuration-only check (no provider API call).
 * Safe to call at startup.
 */
export function getAiConfigurationSnapshot() {
  const env = getAiEnv();
  return {
    provider: env.AI_PROVIDER,
    storyModel: resolveStoryModel(env),
    summaryModel: resolveSummaryModel(env),
    keyPresent: isActiveAiKeyPresent(env),
  };
}

/** Log configured AI provider/models/key presence. Never logs the key. */
export function logAiConfigurationAtStartup() {
  const snap = getAiConfigurationSnapshot();
  logAiEvent("info", "ai.configuration", {
    provider: snap.provider,
    model: snap.storyModel,
    summaryModel: snap.summaryModel,
    keyPresent: snap.keyPresent,
    operation: "startup",
  });
}

async function probeGemini(params: {
  apiKey: string;
  model: string;
}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const response = await ai.models.generateContent({
    model: params.model,
    contents: "Reply with OK only.",
    config: {
      temperature: 0,
      maxOutputTokens: 8,
    },
  });
  return typeof response.text === "string" ? response.text.trim() : "";
}

async function probeOpenAI(params: {
  apiKey: string;
  model: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const response = await client.chat.completions.create({
    model: params.model,
    messages: [{ role: "user", content: "Reply with OK only." }],
    temperature: 0,
    max_completion_tokens: 16,
  });
  const text = response.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}

/**
 * Minimal provider probe. Call explicitly only (CLI/admin/diagnostics).
 * Never invoke on user chat/generation paths.
 */
export async function probeAiHealth(options?: {
  model?: string;
  provider?: "gemini" | "openai" | "mock";
}): Promise<AiHealthCheckResult> {
  const env = getAiEnv();
  const started = Date.now();
  const provider = options?.provider || env.AI_PROVIDER;
  const storyModel = resolveStoryModel(env);
  const summaryModel = resolveSummaryModel(env);
  const probedModel =
    options?.model ||
    (provider === "openai" ? env.OPENAI_STORY_MODEL : env.GEMINI_STORY_MODEL);

  if (provider === "mock") {
    return {
      ok: true,
      status: "ok",
      provider,
      storyModel,
      summaryModel,
      keyPresent: true,
      probedModel: null,
      durationMs: Date.now() - started,
      message: "Mock provider; probe skipped.",
    };
  }

  const keyPresent =
    provider === "openai"
      ? Boolean(env.OPENAI_API_KEY.trim())
      : Boolean(env.GEMINI_API_KEY.trim());

  if (!keyPresent) {
    return {
      ok: false,
      status: "not_configured",
      provider,
      storyModel,
      summaryModel,
      keyPresent: false,
      probedModel,
      durationMs: Date.now() - started,
      code: "AI_NOT_CONFIGURED",
      message:
        provider === "openai"
          ? "OPENAI_API_KEY is not configured."
          : "GEMINI_API_KEY is not configured.",
    };
  }

  try {
    const text =
      provider === "openai"
        ? await probeOpenAI({ apiKey: env.OPENAI_API_KEY, model: probedModel })
        : await probeGemini({ apiKey: env.GEMINI_API_KEY, model: probedModel });

    const durationMs = Date.now() - started;

    if (!text) {
      return {
        ok: false,
        status: "provider_error",
        provider,
        storyModel,
        summaryModel,
        keyPresent: true,
        probedModel,
        durationMs,
        code: "AI_INVALID_RESPONSE",
        message: "Provider returned an empty health-check response.",
      };
    }

    logAiEvent("info", "ai.health_check", {
      provider,
      model: probedModel,
      durationMs,
      operation: "health_check",
      code: "OK",
    });

    return {
      ok: true,
      status: "ok",
      provider,
      storyModel,
      summaryModel,
      keyPresent: true,
      probedModel,
      httpStatus: 200,
      durationMs,
      message: `${provider} health check succeeded.`,
    };
  } catch (error) {
    const normalized = isAIError(error)
      ? error
      : normalizeProviderError(error);
    const durationMs = Date.now() - started;
    const status = classifyHealthFailure(normalized);

    logAiEvent("warn", "ai.health_check", {
      provider,
      model: probedModel,
      code: normalized.code,
      httpStatus: normalized.status,
      durationMs,
      operation: "health_check",
    });

    return {
      ok: false,
      status,
      provider,
      storyModel,
      summaryModel,
      keyPresent: true,
      probedModel,
      httpStatus: normalized.status,
      code: normalized.code,
      durationMs,
      message: normalized.message,
    };
  }
}

/** @deprecated Prefer probeAiHealth */
export async function probeGeminiHealth(options?: {
  model?: string;
}): Promise<AiHealthCheckResult> {
  return probeAiHealth({ ...options, provider: "gemini" });
}

/** Explicit OpenAI probe helper. */
export async function probeOpenAIHealth(options?: {
  model?: string;
}): Promise<AiHealthCheckResult> {
  return probeAiHealth({ ...options, provider: "openai" });
}
