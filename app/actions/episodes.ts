"use server";

import { revalidatePath } from "next/cache";

import { isAIError } from "@/lib/ai/errors";
import {
  DuplicateGenerationError,
  generateEpisodeDraft,
} from "@/lib/ai/services/generate-episode";
import {
  deleteOwnedEpisode,
  saveEpisodeDraft,
  updateSavedEpisode,
} from "@/lib/ai/services/save-episode";
import {
  AuthzError,
  authzToActionError,
  requireEpisodeOwnership,
  requireStoryOwnership,
} from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  RateLimitError,
  UsageLimitError,
} from "@/lib/usage/generation";
import {
  deleteEpisodeSchema,
  generateEpisodeSchema,
  regenerateEpisodeSchema,
  saveEpisodeSchema,
  updateEpisodeSchema,
} from "@/lib/validations/episode";

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
      return fail("STORY_ARCHIVED", "This story is archived and cannot be modified.");
    }
    if (code === "NOT_FOUND") {
      return fail("NOT_FOUND", error.message);
    }
    if (code === "EPISODE_CONFLICT") {
      return fail("EPISODE_CONFLICT", error.message);
    }
  }
  return fail("DATABASE_ERROR", "Something went wrong. Please try again.");
}

export async function generateEpisodeAction(
  input: unknown
): Promise<
  ActionResult<{
    clientRequestId: string;
    title: string;
    content: string;
    wordCount: number;
    provider: string;
    model: string;
    durationMs: number;
    action: string;
    replaceEpisodeId?: string;
  }>
> {
  try {
    const parsed = generateEpisodeSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        fieldErrors[key] = fieldErrors[key] || [];
        fieldErrors[key].push(issue.message);
      }
      return fail("VALIDATION_ERROR", "Invalid generation request.", fieldErrors);
    }

    const { user, story } = await requireStoryOwnership(parsed.data.storyId);
    if (story.status === "ARCHIVED") {
      return fail("STORY_ARCHIVED", "This story is archived and cannot generate episodes.");
    }

    const draft = await generateEpisodeDraft({
      userId: user.id,
      storyId: story.id,
      userInstruction: parsed.data.userInstruction,
      action: parsed.data.action,
      clientRequestId: parsed.data.clientRequestId,
      toneOverride: parsed.data.toneOverride,
      lengthOverride: parsed.data.lengthOverride,
      sourceEpisodeId: parsed.data.sourceEpisodeId,
    });

    // Intentionally do not revalidate as draft is unsaved client state.
    return ok({
      clientRequestId: draft.clientRequestId,
      title: draft.title,
      content: draft.content,
      wordCount: draft.wordCount,
      provider: draft.provider,
      model: draft.model,
      durationMs: draft.durationMs,
      action: draft.action,
      replaceEpisodeId: draft.replaceEpisodeId,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function regenerateEpisodeAction(
  input: unknown
): Promise<
  ActionResult<{
    clientRequestId: string;
    title: string;
    content: string;
    wordCount: number;
    provider: string;
    model: string;
    durationMs: number;
    action: string;
    replaceEpisodeId?: string;
  }>
> {
  try {
    const parsed = regenerateEpisodeSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid regeneration request.");
    }

    const { user, story } = await requireStoryOwnership(parsed.data.storyId);
    if (story.status === "ARCHIVED") {
      return fail("STORY_ARCHIVED", "This story is archived.");
    }

    // Confirm source episode belongs to this story/user.
    await requireEpisodeOwnership(parsed.data.sourceEpisodeId);

    const draft = await generateEpisodeDraft({
      userId: user.id,
      storyId: story.id,
      userInstruction: parsed.data.userInstruction,
      action: parsed.data.action,
      clientRequestId: parsed.data.clientRequestId,
      toneOverride: parsed.data.toneOverride,
      lengthOverride: parsed.data.lengthOverride,
      sourceEpisodeId: parsed.data.sourceEpisodeId,
    });

    return ok({
      clientRequestId: draft.clientRequestId,
      title: draft.title,
      content: draft.content,
      wordCount: draft.wordCount,
      provider: draft.provider,
      model: draft.model,
      durationMs: draft.durationMs,
      action: draft.action,
      replaceEpisodeId: draft.replaceEpisodeId,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function saveEpisodeAction(
  input: unknown
): Promise<
  ActionResult<{
    episodeId: string;
    episodeNumber: number;
    title: string;
    wordCount: number;
    summary: string | null;
    version: number;
    warning?: string;
  }>
> {
  try {
    const parsed = saveEpisodeSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid save request.");
    }

    const { user, story } = await requireStoryOwnership(parsed.data.storyId);
    if (story.status === "ARCHIVED") {
      return fail("STORY_ARCHIVED", "This story is archived.");
    }

    if (parsed.data.replaceEpisodeId) {
      const owned = await requireEpisodeOwnership(parsed.data.replaceEpisodeId);
      if (owned.story.id !== story.id) {
        return fail("NOT_FOUND", "Episode not found.");
      }
    }

    const saved = await saveEpisodeDraft({
      userId: user.id,
      storyId: story.id,
      title: parsed.data.title,
      content: parsed.data.content,
      userInstruction: parsed.data.userInstruction,
      generationAction: parsed.data.generationAction,
      clientRequestId: parsed.data.clientRequestId,
      replaceEpisodeId: parsed.data.replaceEpisodeId,
    });

    revalidatePath(`/stories/${story.id}`);
    revalidatePath(`/stories/${story.id}/episodes/${saved.episodeId}`);
    revalidatePath("/dashboard");
    revalidatePath("/stories");

    return ok(saved, saved.warning);
  } catch (error) {
    return mapError(error);
  }
}

export async function updateEpisodeAction(
  input: unknown
): Promise<
  ActionResult<{
    episodeId: string;
    episodeNumber: number;
    title: string;
    wordCount: number;
    summary: string | null;
    version: number;
    warning?: string;
  }>
> {
  try {
    const parsed = updateEpisodeSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid update request.");
    }

    const { user, episode } = await requireEpisodeOwnership(parsed.data.episodeId);

    const updated = await updateSavedEpisode({
      userId: user.id,
      episodeId: episode.id,
      title: parsed.data.title,
      content: parsed.data.content,
      changeReason: parsed.data.changeReason,
    });

    revalidatePath(`/stories/${episode.storyId}`);
    revalidatePath(`/stories/${episode.storyId}/episodes/${episode.id}`);

    return ok(updated, updated.warning);
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteEpisodeAction(
  input: unknown
): Promise<ActionResult<{ warning?: string }>> {
  try {
    const parsed = deleteEpisodeSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid delete request.");
    }

    const { user, episode } = await requireEpisodeOwnership(parsed.data.episodeId);
    const result = await deleteOwnedEpisode({
      userId: user.id,
      episodeId: episode.id,
    });

    revalidatePath(`/stories/${episode.storyId}`);
    revalidatePath("/dashboard");
    revalidatePath("/stories");

    return ok(result, result.warning);
  } catch (error) {
    return mapError(error);
  }
}
