"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  authzToActionError,
  requireRelationshipOwnership,
  requireStoryOwnership,
} from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  createRelationshipSchema,
  updateRelationshipSchema,
} from "@/lib/validations/story";

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
  revalidatePath(`/stories/${storyId}/characters`);
  revalidatePath(`/stories/${storyId}/edit`);
}

export async function createRelationshipAction(
  storyId: string,
  input: unknown
): Promise<ActionResult<{ relationshipId: string }>> {
  try {
    const { story } = await requireStoryOwnership(storyId);
    const parsed = createRelationshipSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const [source, target] = await Promise.all([
      prisma.character.findFirst({
        where: { id: parsed.data.sourceCharacterId, storyId: story.id },
      }),
      prisma.character.findFirst({
        where: { id: parsed.data.targetCharacterId, storyId: story.id },
      }),
    ]);

    if (!source || !target) {
      return fail("VALIDATION_ERROR", "Both characters must belong to this story.");
    }

    const existing = await prisma.characterRelationship.findFirst({
      where: {
        storyId: story.id,
        sourceCharacterId: parsed.data.sourceCharacterId,
        targetCharacterId: parsed.data.targetCharacterId,
        relationshipType: {
          equals: parsed.data.relationshipType,
          mode: "insensitive",
        },
      },
    });
    if (existing) {
      return fail("DUPLICATE_RELATIONSHIP", "This relationship already exists.");
    }

    const relationship = await prisma.characterRelationship.create({
      data: {
        storyId: story.id,
        ...parsed.data,
      },
    });

    revalidateStory(story.id);
    return ok({ relationshipId: relationship.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function updateRelationshipAction(
  relationshipId: string,
  input: unknown
): Promise<ActionResult<{ relationshipId: string }>> {
  try {
    const { relationship } = await requireRelationshipOwnership(relationshipId);
    const parsed = updateRelationshipSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    await prisma.characterRelationship.update({
      where: { id: relationship.id },
      data: parsed.data,
    });

    revalidateStory(relationship.storyId);
    return ok({ relationshipId: relationship.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function deleteRelationshipAction(
  relationshipId: string
): Promise<ActionResult<{ relationshipId: string }>> {
  try {
    const { relationship } = await requireRelationshipOwnership(relationshipId);
    await prisma.characterRelationship.delete({
      where: { id: relationship.id },
    });
    revalidateStory(relationship.storyId);
    return ok({ relationshipId: relationship.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}
