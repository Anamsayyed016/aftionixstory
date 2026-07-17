import "server-only";

import { AIError, isAIError, normalizeProviderError } from "@/lib/ai/errors";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelayMs?: number } = { maxRetries: 2 }
): Promise<T> {
  const maxRetries = Math.max(0, options.maxRetries);
  const baseDelayMs = options.baseDelayMs ?? 400;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const normalized = isAIError(error) ? error : normalizeProviderError(error);
      lastError = normalized;
      const canRetry = normalized.retryable && attempt < maxRetries;
      if (!canRetry) throw normalized;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError instanceof AIError
    ? lastError
    : new AIError("AI_REQUEST_FAILED", "The AI request failed after retries.", true);
}
