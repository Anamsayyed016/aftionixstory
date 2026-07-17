import "server-only";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export class AuthzError extends Error {
  code: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN";

  constructor(
    code: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "AuthzError";
  }
}

/**
 * Always derive identity from the server session — never trust client userId.
 */
export async function requireAuthenticatedUser() {
  return requireUser();
}

/**
 * Load a story owned by the current user.
 * Uses NOT_FOUND for missing or foreign IDs (no existence leak).
 */
export async function requireStoryOwnership(storyId: string) {
  const user = await requireAuthenticatedUser();
  const story = await prisma.story.findFirst({
    where: { id: storyId, userId: user.id },
  });

  if (!story) {
    throw new AuthzError("NOT_FOUND", "Story not found.");
  }

  return { user, story };
}

export async function requireCharacterOwnership(characterId: string) {
  const user = await requireAuthenticatedUser();
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      story: { userId: user.id },
    },
    include: { story: true },
  });

  if (!character) {
    throw new AuthzError("NOT_FOUND", "Character not found.");
  }

  return { user, character, story: character.story };
}

export async function requireRelationshipOwnership(relationshipId: string) {
  const user = await requireAuthenticatedUser();
  const relationship = await prisma.characterRelationship.findFirst({
    where: {
      id: relationshipId,
      story: { userId: user.id },
    },
    include: { story: true },
  });

  if (!relationship) {
    throw new AuthzError("NOT_FOUND", "Relationship not found.");
  }

  return { user, relationship, story: relationship.story };
}

export async function requireWritingRuleOwnership(ruleId: string) {
  const user = await requireAuthenticatedUser();
  const writingRule = await prisma.writingRule.findFirst({
    where: {
      id: ruleId,
      story: { userId: user.id },
    },
    include: { story: true },
  });

  if (!writingRule) {
    throw new AuthzError("NOT_FOUND", "Writing rule not found.");
  }

  return { user, writingRule, story: writingRule.story };
}

export async function requireEpisodeOwnership(episodeId: string) {
  const user = await requireAuthenticatedUser();
  const episode = await prisma.episode.findFirst({
    where: {
      id: episodeId,
      story: { userId: user.id },
    },
    include: { story: true },
  });

  if (!episode) {
    throw new AuthzError("NOT_FOUND", "Episode not found.");
  }

  return { user, episode, story: episode.story };
}

export function authzToActionError(error: unknown) {
  if (error instanceof AuthzError) {
    return {
      code: error.code,
      message: error.message,
    };
  }
  return {
    code: "DATABASE_ERROR",
    message: "Something went wrong. Please try again.",
  };
}
