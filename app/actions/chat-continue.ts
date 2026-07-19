"use server";

import { z } from "zod";

import { runContinueStoryChatTurn } from "@/lib/ai/services/chat-continue-story";
import { isAIError } from "@/lib/ai/errors";
import { DuplicateGenerationError } from "@/lib/ai/services/generate-episode";
import {
  AuthzError,
  authzToActionError,
  requireStoryOwnership,
} from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { prisma } from "@/lib/db";
import {
  RateLimitError,
  UsageLimitError,
} from "@/lib/usage/generation";
import {
  clientRequestIdSchema,
  generationActionSchema,
} from "@/lib/validations/episode";

const continueStoryChatInputSchema = z.object({
  storyId: z.string().min(1),
  instruction: z.string().trim().min(1).max(5000),
  clientRequestId: clientRequestIdSchema,
  sourceEpisodeId: z.string().min(1).optional(),
  forceAction: generationActionSchema.optional(),
  /** Prior instruction when user asks to revise an unsaved draft. */
  baseInstruction: z.string().trim().max(5000).optional(),
});

export type ContinueStoryChatActionData =
  | {
      status: "needs_more_info";
      assistantReply: string;
      followUpQuestion: string;
    }
  | {
      status: "draft";
      assistantReply: string;
      action: string;
      proposedEpisodeNumber: number;
      clientRequestId: string;
      title: string;
      content: string;
      wordCount: number;
      provider: string;
      model: string;
      durationMs: number;
      replaceEpisodeId?: string;
      userInstruction: string;
    };

function mapError(error: unknown): ActionResult<never> {
  if (error instanceof UsageLimitError) {
    return fail(error.code, error.message);
  }
  if (error instanceof RateLimitError) {
    return fail(error.code, error.message);
  }
  if (error instanceof DuplicateGenerationError) {
    return fail(error.code, error.message);
  }
  if (isAIError(error)) {
    return fail(error.code, error.message);
  }
  if (error instanceof AuthzError) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    if (code === "STORY_ARCHIVED") {
      return fail(
        "STORY_ARCHIVED",
        "This story is archived and cannot generate episodes."
      );
    }
  }
  return fail("DATABASE_ERROR", "Something went wrong. Please try again.");
}

/**
 * Continue-story chat turn.
 * Returns needs_more_info without generation, or an UNSAVED draft via Phase C pipeline.
 */
export async function continueStoryChatAction(
  input: unknown
): Promise<ActionResult<ContinueStoryChatActionData>> {
  try {
    const parsed = continueStoryChatInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please enter a clearer episode instruction."
      );
    }

    const { user, story } = await requireStoryOwnership(parsed.data.storyId);
    if (story.status === "ARCHIVED") {
      return fail(
        "STORY_ARCHIVED",
        "This story is archived and cannot generate episodes."
      );
    }

    const savedCount = await prisma.episode.count({
      where: {
        storyId: story.id,
        generationStatus: "SAVED",
      },
    });

    const result = await runContinueStoryChatTurn({
      userId: user.id,
      storyId: story.id,
      instruction: parsed.data.instruction,
      clientRequestId: parsed.data.clientRequestId,
      hasSavedEpisodes: savedCount > 0,
      sourceEpisodeId: parsed.data.sourceEpisodeId,
      forceAction: parsed.data.forceAction,
      revisionOfInstruction: parsed.data.baseInstruction,
    });

    if (result.status === "needs_more_info") {
      return ok({
        status: "needs_more_info",
        assistantReply: result.assistantReply,
        followUpQuestion: result.followUpQuestion,
      });
    }

    return ok({
      status: "draft",
      assistantReply: result.assistantReply,
      action: result.action,
      proposedEpisodeNumber: result.proposedEpisodeNumber,
      clientRequestId: result.draft.clientRequestId,
      title: result.draft.title,
      content: result.draft.content,
      wordCount: result.draft.wordCount,
      provider: result.draft.provider,
      model: result.draft.model,
      durationMs: result.draft.durationMs,
      replaceEpisodeId: result.draft.replaceEpisodeId,
      userInstruction: parsed.data.baseInstruction
        ? `${parsed.data.baseInstruction}\n${parsed.data.instruction}`
        : parsed.data.instruction,
    });
  } catch (error) {
    return mapError(error);
  }
}
