import "server-only";

import { prisma } from "@/lib/db";

export async function listStoryRelationships(userId: string, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, userId },
    select: { id: true },
  });
  if (!story) return null;

  return prisma.characterRelationship.findMany({
    where: { storyId },
    include: {
      sourceCharacter: true,
      targetCharacter: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
