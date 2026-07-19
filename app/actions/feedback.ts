"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { recordFeedbackExample } from "@/lib/feedback/training-examples";

const feedbackSchema = z.object({
  conversationId: z.string().min(1),
  operation: z.string().min(1).max(80),
  rating: z.enum([
    "helpful",
    "not_helpful",
    "too_formal",
    "not_natural_hinglish",
    "accepted_rewrite",
  ]),
  consentGranted: z.boolean(),
  tags: z.array(z.string().max(40)).max(8).optional(),
  inputSummary: z.string().max(240).optional(),
  outputSummary: z.string().max(240).optional(),
  provider: z.string().max(40).optional(),
  model: z.string().max(80).optional(),
});

export async function submitChatFeedbackAction(
  input: unknown
): Promise<ActionResult<{ stored: boolean; reason: string }>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = feedbackSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid feedback.");
    }

    const result = await recordFeedbackExample({
      userId: user.id,
      conversationId: parsed.data.conversationId,
      operation: parsed.data.operation,
      rating: parsed.data.rating,
      tags: parsed.data.tags ?? [],
      consentStatus: parsed.data.consentGranted ? "granted" : "denied",
      inputSummary: parsed.data.inputSummary,
      outputSummary: parsed.data.outputSummary,
      provider: parsed.data.provider,
      model: parsed.data.model,
    });

    return ok(result);
  } catch {
    return fail("AI_REQUEST_FAILED", "Could not save feedback.");
  }
}
