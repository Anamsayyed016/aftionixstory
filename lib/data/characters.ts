import "server-only";

import type { CharacterStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

export async function listStoryCharacters(
  userId: string,
  storyId: string,
  options: {
    q?: string;
    role?: string;
    status?: CharacterStatus | "ALL";
  } = {}
) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, userId },
    select: { id: true },
  });
  if (!story) return null;

  return prisma.character.findMany({
    where: {
      storyId,
      ...(options.status && options.status !== "ALL"
        ? { status: options.status }
        : {}),
      ...(options.role
        ? { role: { equals: options.role, mode: "insensitive" } }
        : {}),
      ...(options.q
        ? { name: { contains: options.q, mode: "insensitive" } }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          outgoingRelationships: true,
          incomingRelationships: true,
        },
      },
    },
  });
}

export async function countActiveCharacters(userId: string, storyId: string) {
  return prisma.character.count({
    where: {
      storyId,
      status: "ACTIVE",
      story: { userId },
    },
  });
}

export async function countUserCharacters(userId: string) {
  return prisma.character.count({
    where: { story: { userId } },
  });
}
