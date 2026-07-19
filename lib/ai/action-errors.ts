import { isAIError, AI_QUOTA_EXCEEDED_MESSAGE } from "@/lib/ai/errors";
import { fail, type ActionResult } from "@/lib/actions/result";

/**
 * Map AI provider errors to ActionResult failures.
 * Preserves AI_QUOTA_EXCEEDED as its own code (never remaps to rate-limit).
 */
export function toFriendlyAiActionError(error: unknown): ActionResult<never> | null {
  if (!isAIError(error)) return null;

  if (error.code === "AI_QUOTA_EXCEEDED") {
    return fail("AI_QUOTA_EXCEEDED", AI_QUOTA_EXCEEDED_MESSAGE);
  }

  return fail(error.code, error.message);
}
