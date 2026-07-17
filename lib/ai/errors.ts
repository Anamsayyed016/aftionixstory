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

export class AIError extends Error {
  code: AIErrorCode;
  retryable: boolean;

  constructor(code: AIErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

/** Map provider/SDK errors into normalized AIError codes. */
export function normalizeProviderError(error: unknown): AIError {
  if (error instanceof AIError) return error;

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIError("AI_TIMEOUT", "The AI request timed out.", true);
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  if (
    message.includes("api key") ||
    message.includes("api_key") ||
    message.includes("not configured")
  ) {
    return new AIError("AI_NOT_CONFIGURED", "AI provider is not configured.", false);
  }

  if (status === 429 || message.includes("rate") || message.includes("resource_exhausted")) {
    return new AIError(
      "AI_RATE_LIMITED",
      "The AI provider rate-limited this request. Try again shortly.",
      true
    );
  }

  if (
    status === 403 ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("exceeded your current quota")
  ) {
    return new AIError(
      "AI_QUOTA_EXCEEDED",
      "AI quota has been exceeded for this project.",
      false
    );
  }

  if (
    message.includes("blocked") ||
    message.includes("safety") ||
    message.includes("forbidden") ||
    message.includes("prohibited")
  ) {
    return new AIError(
      "AI_CONTENT_BLOCKED",
      "The provider blocked this generation for safety policy reasons.",
      false
    );
  }

  if (message.includes("model") && (message.includes("not found") || message.includes("invalid"))) {
    return new AIError("AI_INVALID_MODEL", "The configured AI model is invalid.", false);
  }

  if (
    status === 503 ||
    status === 502 ||
    message.includes("unavailable") ||
    message.includes("overloaded")
  ) {
    return new AIError(
      "AI_PROVIDER_UNAVAILABLE",
      "The AI provider is temporarily unavailable.",
      true
    );
  }

  if (message.includes("timeout") || message.includes("timed out") || status === 408) {
    return new AIError("AI_TIMEOUT", "The AI request timed out.", true);
  }

  return new AIError(
    "AI_REQUEST_FAILED",
    "The AI provider request failed. Please try again.",
    true
  );
}
