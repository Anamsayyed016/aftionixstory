/**
 * Canonical provider errors (Phase F).
 */

export const PROVIDER_ERROR_CODES = [
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_AUTH_FAILED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_INVALID_REQUEST",
  "PROVIDER_CONTEXT_TOO_LARGE",
  "PROVIDER_OUTPUT_TRUNCATED",
  "PROVIDER_SAFETY_REFUSAL",
  "PROVIDER_EMPTY_OUTPUT",
  "PROVIDER_MALFORMED_JSON",
  "PROVIDER_UNKNOWN",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export type ProviderError = {
  code: ProviderErrorCode;
  provider: string;
  retryable: boolean;
  fallbackAllowed: boolean;
  statusCode: number | null;
  message: string;
  internalCause?: string | null;
};

export function makeProviderError(
  partial: Omit<ProviderError, "statusCode" | "internalCause"> & {
    statusCode?: number | null;
    internalCause?: string | null;
  }
): ProviderError {
  return {
    statusCode: partial.statusCode ?? null,
    internalCause: partial.internalCause ?? null,
    ...partial,
  };
}

export function isProviderError(error: unknown): error is ProviderError {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in (error as object) &&
    "retryable" in (error as object) &&
    PROVIDER_ERROR_CODES.includes(
      (error as ProviderError).code as ProviderErrorCode
    )
  );
}

/** Map legacy AIError codes → ProviderErrorCode. */
export function fromAiErrorCode(
  code: string
): { code: ProviderErrorCode; retryable: boolean; fallbackAllowed: boolean } {
  switch (code) {
    case "AI_TIMEOUT":
      return {
        code: "PROVIDER_TIMEOUT",
        retryable: true,
        fallbackAllowed: true,
      };
    case "AI_RATE_LIMITED":
      return {
        code: "PROVIDER_RATE_LIMITED",
        retryable: true,
        fallbackAllowed: true,
      };
    case "AI_QUOTA_EXCEEDED":
      return {
        code: "PROVIDER_AUTH_FAILED",
        retryable: false,
        fallbackAllowed: true,
      };
    case "AI_NOT_CONFIGURED":
      return {
        code: "PROVIDER_NOT_CONFIGURED",
        retryable: false,
        fallbackAllowed: true,
      };
    case "AI_INVALID_MODEL":
      return {
        code: "PROVIDER_INVALID_REQUEST",
        retryable: false,
        fallbackAllowed: true,
      };
    case "AI_CONTENT_BLOCKED":
      return {
        code: "PROVIDER_SAFETY_REFUSAL",
        retryable: false,
        fallbackAllowed: false,
      };
    case "AI_INVALID_RESPONSE":
      return {
        code: "PROVIDER_EMPTY_OUTPUT",
        retryable: false,
        fallbackAllowed: true,
      };
    case "AI_PROVIDER_UNAVAILABLE":
      return {
        code: "PROVIDER_UNAVAILABLE",
        retryable: true,
        fallbackAllowed: true,
      };
    default:
      return {
        code: "PROVIDER_UNKNOWN",
        retryable: true,
        fallbackAllowed: true,
      };
  }
}

export function userFacingGenerationMessage(operation: string): string {
  const op = operation.toLowerCase();
  if (op.includes("classifier") || op.includes("intent")) {
    return "I couldn’t classify that request. Please try again.";
  }
  if (
    op.includes("write") ||
    op.includes("scene") ||
    op.includes("episode") ||
    op.includes("revise") ||
    op.includes("creative")
  ) {
    return "I couldn’t finish this scene properly. Please retry once.";
  }
  if (
    op.includes("knowledge") ||
    op.includes("question") ||
    op.includes("summar")
  ) {
    return "I couldn’t retrieve a reliable answer from the saved story context. Please retry.";
  }
  if (op.includes("phase_a") || op.includes("brainstorm") || op.includes("collab")) {
    return "I couldn’t complete that reply properly. Please retry once. 🙂";
  }
  return "I couldn’t complete that request. Please retry once.";
}
