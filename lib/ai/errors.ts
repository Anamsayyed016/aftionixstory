export type AIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_CONTENT_BLOCKED"
  | "AI_INVALID_RESPONSE"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_INVALID_MODEL"
  | "AI_REQUEST_FAILED";

export const AI_QUOTA_EXCEEDED_MESSAGE =
  "AI quota is unavailable for the configured model. Please contact support or try again later.";

export class AIError extends Error {
  code: AIErrorCode;
  retryable: boolean;
  /** HTTP status from the provider SDK when available. */
  status?: number;

  constructor(
    code: AIErrorCode,
    message: string,
    retryable = false,
    status?: number
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

/** Codes that must never be retried. */
export function isNonRetryableAIError(error: AIError): boolean {
  return (
    error.code === "AI_QUOTA_EXCEEDED" ||
    error.code === "AI_NOT_CONFIGURED" ||
    error.code === "AI_INVALID_MODEL" ||
    error.code === "AI_CONTENT_BLOCKED" ||
    error.code === "AI_INVALID_RESPONSE" ||
    error.retryable === false
  );
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as { status?: unknown; statusCode?: unknown };
  if (typeof record.status === "number") return record.status;
  if (typeof record.statusCode === "number") return record.statusCode;
  return undefined;
}

function extractProviderCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as { code?: unknown; error?: { code?: unknown } };
  if (typeof record.code === "string") return record.code.toLowerCase();
  if (typeof record.error?.code === "string") {
    return record.error.code.toLowerCase();
  }
  return undefined;
}

function hasQuotaIndicators(message: string, providerCode?: string): boolean {
  if (
    providerCode === "insufficient_quota" ||
    providerCode === "billing_not_active" ||
    providerCode === "billing_hard_limit_reached"
  ) {
    return true;
  }
  return (
    message.includes("quota") ||
    message.includes("quota exceeded") ||
    message.includes("exceeded your current quota") ||
    message.includes("insufficient_quota") ||
    message.includes("limit: 0") ||
    /limit:\s*0\b/.test(message) ||
    message.includes("billing") ||
    (message.includes("resource_exhausted") &&
      (message.includes("quota") || message.includes("limit"))) ||
    (message.includes("resource has been exhausted") &&
      (message.includes("quota") || message.includes("billing")))
  );
}

function hasExplicitRateLimitIndicators(
  message: string,
  providerCode?: string
): boolean {
  if (
    providerCode === "rate_limit_exceeded" ||
    providerCode === "rate_limit_error"
  ) {
    return true;
  }
  return (
    message.includes("rate limit") ||
    message.includes("rate-limit") ||
    message.includes("rate_limit") ||
    message.includes("too many requests") ||
    /\brpm\b/.test(message) ||
    /\btpm\b/.test(message)
  );
}

function hasAuthIndicators(
  message: string,
  status?: number,
  providerCode?: string
): boolean {
  if (
    providerCode === "invalid_api_key" ||
    providerCode === "invalid_api_key_error"
  ) {
    return true;
  }
  return (
    status === 401 ||
    message.includes("api key") ||
    message.includes("api_key") ||
    message.includes("not configured") ||
    message.includes("invalid api key") ||
    message.includes("api key not valid") ||
    message.includes("incorrect api key") ||
    message.includes("unauthenticated") ||
    message.includes("permission denied")
  );
}

function hasModelNotFoundIndicators(
  message: string,
  status?: number,
  providerCode?: string
): boolean {
  if (providerCode === "model_not_found") return true;
  return (
    status === 404 ||
    message.includes("is not found for api version") ||
    message.includes("model not found") ||
    (message.includes("does not exist") && message.includes("model")) ||
    (message.includes("models/") && message.includes("not found")) ||
    message.includes("not supported for generatecontent") ||
    message.includes("unknown model") ||
    /\binvalid model\b/.test(message)
  );
}

function hasNetworkIndicators(message: string): boolean {
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("socket hang up") ||
    message.includes("dns")
  );
}

/** Map provider/SDK errors into normalized AIError codes. */
export function normalizeProviderError(error: unknown): AIError {
  if (error instanceof AIError) return error;

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIError("AI_TIMEOUT", "The AI request timed out.", true);
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const status = extractStatus(error);
  const providerCode = extractProviderCode(error);

  // 1. Authentication / invalid key
  if (hasAuthIndicators(message, status, providerCode)) {
    return new AIError(
      "AI_NOT_CONFIGURED",
      "AI provider is not configured.",
      false,
      status
    );
  }

  // 2. Model not found or unsupported
  if (hasModelNotFoundIndicators(message, status, providerCode)) {
    return new AIError(
      "AI_INVALID_MODEL",
      "The configured AI model is invalid.",
      false,
      status
    );
  }

  // 3. Quota exhausted (including HTTP 429 with quota/limit:0 indicators)
  if (
    hasQuotaIndicators(message, providerCode) ||
    (status === 403 && message.includes("quota"))
  ) {
    return new AIError(
      "AI_QUOTA_EXCEEDED",
      AI_QUOTA_EXCEEDED_MESSAGE,
      false,
      status
    );
  }

  // RESOURCE_EXHAUSTED without clear quota wording — treat as quota when status is 429
  // only if the body also looks quota-like; otherwise fall through to rate limit.
  if (
    message.includes("resource_exhausted") ||
    message.includes("resource has been exhausted")
  ) {
    return new AIError(
      "AI_QUOTA_EXCEEDED",
      AI_QUOTA_EXCEEDED_MESSAGE,
      false,
      status
    );
  }

  // 4. Rate limited (HTTP 429 without quota indicators, or explicit rate phrases)
  if (
    (status === 429 && !hasQuotaIndicators(message, providerCode)) ||
    hasExplicitRateLimitIndicators(message, providerCode)
  ) {
    return new AIError(
      "AI_RATE_LIMITED",
      "The AI provider rate-limited this request. Try again shortly.",
      true,
      status
    );
  }

  // Content blocked
  if (
    message.includes("blocked") ||
    message.includes("safety") ||
    message.includes("forbidden") ||
    message.includes("prohibited")
  ) {
    return new AIError(
      "AI_CONTENT_BLOCKED",
      "The provider blocked this generation for safety policy reasons.",
      false,
      status
    );
  }

  // 5. Timeout
  if (message.includes("timeout") || message.includes("timed out") || status === 408) {
    return new AIError("AI_TIMEOUT", "The AI request timed out.", true, status);
  }

  // 6. Network
  if (hasNetworkIndicators(message)) {
    return new AIError(
      "AI_REQUEST_FAILED",
      "The AI provider request failed. Please try again.",
      true,
      status
    );
  }

  // 7. Provider unavailable
  if (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 500 ||
    message.includes("unavailable") ||
    message.includes("overloaded")
  ) {
    return new AIError(
      "AI_PROVIDER_UNAVAILABLE",
      "The AI provider is temporarily unavailable.",
      true,
      status
    );
  }

  // 8. Unknown provider error
  return new AIError(
    "AI_REQUEST_FAILED",
    "The AI provider request failed. Please try again.",
    true,
    status
  );
}
