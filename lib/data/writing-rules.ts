import "server-only";

import { prisma } from "@/lib/db";

export async function listStoryWritingRules(userId: string, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, userId },
    select: { id: true },
  });
  if (!story) return null;

  return prisma.writingRule.findMany({
    where: { storyId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function countActiveWritingRules(userId: string) {
  return prisma.writingRule.count({
    where: { isActive: true, story: { userId } },
  });
}
