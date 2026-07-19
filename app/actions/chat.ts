"use server";

import { z } from "zod";

import { runChatCreateStoryTurn } from "@/lib/ai/services/chat-create-story";
import { toFriendlyAiActionError } from "@/lib/ai/action-errors";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  chatStoryDraftSchema,
  normalizeChatStoryDraft,
  type NormalizedChatStoryDraft,
} from "@/lib/chat/create-story-extraction";
import {
  assertGenerationRateLimit,
  assertWithinGenerationLimit,
} from "@/lib/usage/generation";
import type { CreateStoryWizardInput } from "@/lib/validations/story";

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const chatCreateStoryInputSchema = z.object({
  messages: z.array(chatTurnSchema).min(1).max(40),
  currentStory: z.unknown().optional(),
});

export type ChatCreateStoryActionData = {
  assistantReply: string;
  status: "complete" | "needs_more_info";
  missing: string[];
  story: NormalizedChatStoryDraft;
  wizardInput: CreateStoryWizardInput | null;
};

function toFriendlyAiError(error: unknown): ActionResult<never> {
  const mapped = toFriendlyAiActionError(error);
  if (mapped) return mapped;
  if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
    return fail(
      "AI_NOT_CONFIGURED",
      "Gemini is not configured on the server yet."
    );
  }
  return fail(
    "AI_REQUEST_FAILED",
    "Something went wrong with the story assistant. Please try again."
  );
}

function coerceCurrentStory(raw: unknown): NormalizedChatStoryDraft | null {
  if (raw == null) return null;
  const parsed = chatStoryDraftSchema.safeParse(raw);
  if (parsed.success) return normalizeChatStoryDraft(parsed.data);
  return normalizeChatStoryDraft(raw as never);
}

/**
 * Conversational create-story turn.
 * Does not write a Story — only extracts a draft for the user to confirm.
 */
/**
 * @deprecated Create Story chat must use `storyAgentTurnAction` instead.
 * Kept only for Phase 2 extraction unit tests / internal helpers.
 * Do not call from CreateStoryChat UI.
 */
export async function chatCreateStoryAction(
  input: unknown
): Promise<ActionResult<ChatCreateStoryActionData>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = chatCreateStoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please enter a valid message to continue."
      );
    }

    await assertWithinGenerationLimit(user.id);
    await assertGenerationRateLimit(user.id);

    const currentStory = coerceCurrentStory(parsed.data.currentStory);

    const result = await runChatCreateStoryTurn({
      messages: parsed.data.messages,
      currentStory,
    });

    return ok({
      assistantReply: result.assistantReply,
      status: result.status,
      missing: result.missing,
      story: result.story,
      wizardInput: result.wizardInput,
    });
  } catch (error) {
    return toFriendlyAiError(error);
  }
}
