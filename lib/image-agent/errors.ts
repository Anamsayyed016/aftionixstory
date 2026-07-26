import {
  AIError,
  isAIError,
  normalizeProviderError,
  type AIErrorCode,
} from "@/lib/ai/errors";
import { AuthzError } from "@/lib/auth/authorization";

/** Normalize any thrown error into an AIError; never leak raw provider text. */
export function normalizeImageAgentError(error: unknown): AIError {
  return isAIError(error) ? error : normalizeProviderError(error);
}

/** Fixed, safe copy per error code — never interpolates the raw provider message. */
export function friendlyImageErrorMessage(code: AIErrorCode): string {
  switch (code) {
    case "AI_RATE_LIMITED":
      return "Image generation is busy right now. Please try again in a moment.";
    case "AI_QUOTA_EXCEEDED":
      return "Image generation quota has been reached. Please try again later or contact support.";
    case "AI_CONTENT_BLOCKED":
      return "This request was blocked by the image provider's content policy. Try adjusting the character or story details.";
    case "AI_TIMEOUT":
      return "Image generation timed out. Please try again.";
    case "AI_NOT_CONFIGURED":
    case "AI_INVALID_MODEL":
      return "Image generation isn't available right now. Please contact support.";
    case "AI_PROVIDER_UNAVAILABLE":
      return "The image provider is temporarily unavailable. Please try again shortly.";
    case "AI_INVALID_RESPONSE":
    case "AI_REQUEST_FAILED":
    default:
      return "We couldn't generate that image. Please try again.";
  }
}

function statusForCode(code: AIErrorCode): number {
  switch (code) {
    case "AI_RATE_LIMITED":
      return 429;
    case "AI_CONTENT_BLOCKED":
      return 422;
    case "AI_NOT_CONFIGURED":
    case "AI_INVALID_MODEL":
      return 503;
    default:
      return 500;
  }
}

/** Route-boundary mapper: any thrown error -> a safe { status, message } pair. */
export function mapImageAgentError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof AuthzError) {
    const status =
      error.code === "UNAUTHORIZED" ? 401 : error.code === "FORBIDDEN" ? 403 : 404;
    return { status, message: error.message };
  }

  const normalized = normalizeImageAgentError(error);
  return {
    status: statusForCode(normalized.code),
    message: friendlyImageErrorMessage(normalized.code),
  };
}
