import { afterEach, describe, expect, it, vi } from "vitest";

import { toFriendlyAiActionError } from "@/lib/ai/action-errors";
import {
  AIError,
  AI_QUOTA_EXCEEDED_MESSAGE,
  normalizeProviderError,
} from "@/lib/ai/errors";
import { shouldRetryAIError, withRetry } from "@/lib/ai/retry";

function apiError(message: string, status: number) {
  const err = new Error(message) as Error & { status: number };
  err.name = "ApiError";
  err.status = status;
  return err;
}

describe("normalizeProviderError — quota vs rate-limit", () => {
  it("maps HTTP 429 + quota text to AI_QUOTA_EXCEEDED", () => {
    const err = normalizeProviderError(
      apiError(
        JSON.stringify({
          error: {
            code: 429,
            message:
              "You exceeded your current quota, please check your plan and billing details.",
          },
        }),
        429
      )
    );
    expect(err.code).toBe("AI_QUOTA_EXCEEDED");
    expect(err.message).toBe(AI_QUOTA_EXCEEDED_MESSAGE);
    expect(err.retryable).toBe(false);
  });

  it("maps HTTP 429 + limit: 0 to AI_QUOTA_EXCEEDED", () => {
    const err = normalizeProviderError(
      apiError(
        "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content, limit: 0, model: gemini-2.0-flash",
        429
      )
    );
    expect(err.code).toBe("AI_QUOTA_EXCEEDED");
    expect(err.retryable).toBe(false);
  });

  it("maps HTTP 429 + too many requests to AI_RATE_LIMITED", () => {
    const err = normalizeProviderError(
      apiError("Too many requests. Please retry later.", 429)
    );
    expect(err.code).toBe("AI_RATE_LIMITED");
    expect(err.retryable).toBe(true);
  });

  it("does not classify generateContent as rate-limited", () => {
    const err = normalizeProviderError(
      apiError(
        JSON.stringify({
          error: {
            code: 400,
            message:
              "models/gemini-2.0-flash:generateContent failed with invalid argument",
            status: "INVALID_ARGUMENT",
          },
        }),
        400
      )
    );
    expect(err.code).not.toBe("AI_RATE_LIMITED");
    expect(err.code).not.toBe("AI_QUOTA_EXCEEDED");
  });

  it("maps invalid API key to authentication error", () => {
    const err = normalizeProviderError(
      apiError("API key not valid. Please pass a valid API key.", 400)
    );
    expect(err.code).toBe("AI_NOT_CONFIGURED");
    expect(err.retryable).toBe(false);
  });

  it("maps unsupported model to AI_INVALID_MODEL", () => {
    const err = normalizeProviderError(
      apiError(
        "models/gemini-nope is not found for API version v1beta",
        404
      )
    );
    expect(err.code).toBe("AI_INVALID_MODEL");
    expect(err.retryable).toBe(false);
  });
});

describe("retry policy", () => {
  it("does not retry quota exhausted errors", async () => {
    const quota = new AIError(
      "AI_QUOTA_EXCEEDED",
      AI_QUOTA_EXCEEDED_MESSAGE,
      false,
      429
    );
    expect(shouldRetryAIError(quota)).toBe(false);

    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw quota;
        },
        { maxRetries: 2, baseDelayMs: 1 }
      )
    ).rejects.toMatchObject({ code: "AI_QUOTA_EXCEEDED" });
    expect(calls).toBe(1);
  });

  it("retries temporary rate limits according to policy", async () => {
    const rate = new AIError(
      "AI_RATE_LIMITED",
      "The AI provider rate-limited this request. Try again shortly.",
      true,
      429
    );
    expect(shouldRetryAIError(rate)).toBe(true);

    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw rate;
        },
        { maxRetries: 2, baseDelayMs: 1 }
      )
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED" });
    expect(calls).toBe(3);
  });
});

describe("chat action AI error mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Create Story path preserves quota-friendly message", () => {
    const result = toFriendlyAiActionError(
      new AIError("AI_QUOTA_EXCEEDED", "raw google body", false, 429)
    );
    expect(result).toEqual({
      success: false,
      error: {
        code: "AI_QUOTA_EXCEEDED",
        message: AI_QUOTA_EXCEEDED_MESSAGE,
      },
    });
  });

  it("Continue Story path preserves quota-friendly message", () => {
    const result = toFriendlyAiActionError(
      new AIError("AI_QUOTA_EXCEEDED", "raw google body", false, 429)
    );
    expect(result?.success).toBe(false);
    if (result && !result.success) {
      expect(result.error.code).toBe("AI_QUOTA_EXCEEDED");
      expect(result.error.message).toBe(AI_QUOTA_EXCEEDED_MESSAGE);
      expect(result.error.message).not.toContain("rate-limited");
    }
  });

  it("does not convert quota into rate-limited", () => {
    const result = toFriendlyAiActionError(
      normalizeProviderError(
        apiError(
          "You exceeded your current quota. limit: 0",
          429
        )
      )
    );
    expect(result?.success).toBe(false);
    if (result && !result.success) {
      expect(result.error.code).toBe("AI_QUOTA_EXCEEDED");
      expect(result.error.code).not.toBe("AI_RATE_LIMITED");
    }
  });
});
