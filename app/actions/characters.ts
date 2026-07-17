"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  authzToActionError,
  requireCharacterOwnership,
  requireStoryOwnership,
} from "@/lib/auth/authorization";
import { countActiveCharacters } from "@/lib/data/characters";
import { getPlanLimits } from "@/lib/plans";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  createCharacterSchema,
  updateCharacterSchema,
} from "@/lib/validations/story";

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
  revalidatePath(`/stories/${storyId}/characters`);
  revalidatePath(`/stories/${storyId}/edit`);
  revalidatePath("/stories");
  revalidatePath("/dashboard");
}

export async function createCharacterAction(
  storyId: string,
  input: unknown
): Promise<ActionResult<{ characterId: string }>> {
  try {
    const { user, story } = await requireStoryOwnership(storyId);
    const parsed = createCharacterSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const dup = await prisma.character.findFirst({
      where: {
        storyId: story.id,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (dup) {
      return fail("DUPLICATE_CHARACTER", "A character with this name already exists.");
    }

    const limits = getPlanLimits(user.plan);
    const activeCount = await countActiveCharacters(user.id, story.id);
    if (activeCount >= limits.maxActiveCharactersPerStory) {
      return fail(
        "CHARACTER_LIMIT_REACHED",
        `Your plan allows up to ${limits.maxActiveCharactersPerStory} active characters per story.`
      );
    }

    const character = await prisma.character.create({
      data: {
        storyId: story.id,
        ...parsed.data,
        age: parsed.data.age ?? null,
      },
    });

    revalidateStory(story.id);
    return ok({ characterId: character.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function updateCharacterAction(
  characterId: string,
  input: unknown
): Promise<ActionResult<{ characterId: string }>> {
  try {
    const { character } = await requireCharacterOwnership(characterId);
    const parsed = updateCharacterSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    if (parsed.data.name) {
      const dup = await prisma.character.findFirst({
        where: {
          storyId: character.storyId,
          id: { not: character.id },
          name: { equals: parsed.data.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (dup) {
        return fail("DUPLICATE_CHARACTER", "A character with this name already exists.");
      }
    }

    await prisma.character.update({
      where: { id: character.id },
      data: {
        ...parsed.data,
        age: parsed.data.age === undefined ? undefined : parsed.data.age,
      },
    });

    revalidateStory(character.storyId);
    return ok({ characterId: character.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function archiveCharacterAction(
  characterId: string
): Promise<ActionResult<{ characterId: string }>> {
  try {
    const { character } = await requireCharacterOwnership(characterId);
    await prisma.character.update({
      where: { id: character.id },
      data: { status: "ARCHIVED" },
    });
    revalidateStory(character.storyId);
    return ok({ characterId: character.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function deleteCharacterAction(
  characterId: string
): Promise<ActionResult<{ characterId: string }>> {
  try {
    const { character } = await requireCharacterOwnership(characterId);
    const relCount = await prisma.characterRelationship.count({
      where: {
        OR: [
          { sourceCharacterId: character.id },
          { targetCharacterId: character.id },
        ],
      },
    });

    if (relCount > 0) {
      return fail(
        "CONFLICT",
        "This character has relationships. Remove those relationships first, or archive the character instead."
      );
    }

    await prisma.character.delete({ where: { id: character.id } });
    revalidateStory(character.storyId);
    return ok({ characterId: character.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}
