import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AIError,
  AI_QUOTA_EXCEEDED_MESSAGE,
  normalizeProviderError,
} from "@/lib/ai/errors";
import { probeAiHealth } from "@/lib/ai/health";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import {
  OpenAIProvider,
  cleanProviderText,
  wantsJsonOutput,
} from "@/lib/ai/providers/openai";
import { getAIProvider, setAIProviderOverride } from "@/lib/ai/registry";
import { __resetEnvCacheForTests } from "@/lib/env";

function apiError(
  message: string,
  status: number,
  code?: string
): Error & { status: number; code?: string } {
  const err = new Error(message) as Error & { status: number; code?: string };
  err.name = "APIError";
  err.status = status;
  if (code) err.code = code;
  return err;
}

describe("OpenAI provider", () => {
  beforeEach(() => {
    __resetEnvCacheForTests();
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.OPENAI_STORY_MODEL = "gpt-5-mini";
    process.env.OPENAI_SUMMARY_MODEL = "gpt-5-nano";
    setAIProviderOverride(null);
  });

  afterEach(() => {
    setAIProviderOverride(null);
    __resetEnvCacheForTests();
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.restoreAllMocks();
  });

  it("selects OpenAI from the registry when AI_PROVIDER=openai", () => {
    const provider = getAIProvider();
    expect(provider.name).toBe("openai");
  });

  it("selects Gemini from the registry when AI_PROVIDER=gemini", () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "gem-test";
    __resetEnvCacheForTests();
    expect(getAIProvider().name).toBe("gemini");
  });

  it("supports registry override switching", () => {
    setAIProviderOverride(new MockAIProvider(() => "ok"));
    expect(getAIProvider().name).toBe("mock");
    setAIProviderOverride(null);
    expect(getAIProvider().name).toBe("openai");
  });

  it("returns successful text from OpenAI chat completions", async () => {
    const create = vi.fn(async () => ({
      choices: [
        { message: { content: "Hello from OpenAI" }, finish_reason: "stop" },
      ],
    }));
    const provider = new OpenAIProvider(() => ({
      chat: { completions: { create } },
    }));

    const result = await provider.generateText({
      systemInstruction: "You are a writer.",
      prompt: "Say hello",
      temperature: 0.5,
      maxOutputTokens: 128,
      model: "gpt-5-mini",
    });

    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5-mini");
    expect(result.text).toBe("Hello from OpenAI");
    expect(create).toHaveBeenCalledOnce();
    const args = create.mock.calls[0][0] as Record<string, unknown>;
    expect(args.model).toBe("gpt-5-mini");
    expect(args.temperature).toBeUndefined();
    expect(args.max_completion_tokens).toBe(128);
    expect(args.response_format).toBeUndefined();
  });

  it("omits temperature for gpt-5 models", async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
    }));
    const provider = new OpenAIProvider(() => ({
      chat: { completions: { create } },
    }));

    await provider.generateText({
      systemInstruction: "sys",
      prompt: "hi",
      temperature: 0.9,
      model: "gpt-5-mini",
    });

    const args = create.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("temperature");
  });

  it("passes temperature for models that support it", async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
    }));
    const provider = new OpenAIProvider(() => ({
      chat: { completions: { create } },
    }));

    await provider.generateText({
      systemInstruction: "sys",
      prompt: "hi",
      temperature: 0.4,
      model: "gpt-4o-mini",
    });

    const args = create.mock.calls[0][0] as Record<string, unknown>;
    expect(args.temperature).toBe(0.4);
  });

  it("uses json_object response_format for structured JSON prompts", async () => {
    const create = vi.fn(async () => ({
      choices: [
        {
          message: { content: '{"status":"complete","assistantReply":"ok"}' },
          finish_reason: "stop",
        },
      ],
    }));
    const provider = new OpenAIProvider(() => ({
      chat: { completions: { create } },
    }));

    const result = await provider.generateText({
      systemInstruction: "Always respond with JSON only.",
      prompt: "Return the next JSON extraction now.",
      model: "gpt-5-mini",
    });

    expect(
      wantsJsonOutput({
        systemInstruction: "Always respond with JSON only.",
        prompt: "x",
      })
    ).toBe(true);
    expect(result.text).toBe('{"status":"complete","assistantReply":"ok"}');
    const args = create.mock.calls[0][0] as Record<string, unknown>;
    expect(args.response_format).toEqual({ type: "json_object" });
  });

  it("strips markdown fences from JSON responses", () => {
    expect(cleanProviderText('```json\n{"a":1}\n```', true)).toBe('{"a":1}');
  });

  it("maps OpenAI quota errors", () => {
    const err = normalizeProviderError(
      apiError("You exceeded your current quota", 429, "insufficient_quota")
    );
    expect(err.code).toBe("AI_QUOTA_EXCEEDED");
    expect(err.message).toBe(AI_QUOTA_EXCEEDED_MESSAGE);
    expect(err.retryable).toBe(false);
  });

  it("maps OpenAI rate-limit errors", () => {
    const err = normalizeProviderError(
      apiError("Rate limit reached for rpm", 429, "rate_limit_exceeded")
    );
    expect(err.code).toBe("AI_RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("maps invalid API key", () => {
    const err = normalizeProviderError(
      apiError("Incorrect API key provided", 401, "invalid_api_key")
    );
    expect(err.code).toBe("AI_NOT_CONFIGURED");
  });

  it("maps model not found", () => {
    const err = normalizeProviderError(
      apiError("The model `gpt-nope` does not exist", 404, "model_not_found")
    );
    expect(err.code).toBe("AI_INVALID_MODEL");
  });

  it("throws AI_NOT_CONFIGURED when key missing", async () => {
    process.env.OPENAI_API_KEY = "";
    __resetEnvCacheForTests();
    const provider = new OpenAIProvider(() => ({
      chat: { completions: { create: vi.fn() } },
    }));
    await expect(
      provider.generateText({
        systemInstruction: "sys",
        prompt: "hi",
      })
    ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  });

  it("normalizes thrown OpenAI SDK failures through generateText", async () => {
    const provider = new OpenAIProvider(() => ({
      chat: {
        completions: {
          create: async () => {
            throw apiError("Rate limit reached", 429, "rate_limit_exceeded");
          },
        },
      },
    }));

    await expect(
      provider.generateText({
        systemInstruction: "sys",
        prompt: "hi",
        model: "gpt-5-mini",
      })
    ).rejects.toBeInstanceOf(AIError);

    await expect(
      provider.generateText({
        systemInstruction: "sys",
        prompt: "hi",
        model: "gpt-5-mini",
      })
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED" });
  });

  it("health check reports not_configured without OpenAI key", async () => {
    process.env.OPENAI_API_KEY = "";
    __resetEnvCacheForTests();
    const result = await probeAiHealth({ provider: "openai" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_configured");
    expect(result.provider).toBe("openai");
    expect(result.keyPresent).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/sk-/);
  });
});
