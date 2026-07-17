import "server-only";

import type { Prisma, StoryStatus } from "@prisma/client";

import { prisma } from "@/lib/db";

export type StoryListFilters = {
  q?: string;
  status?: StoryStatus | "ALL";
  genre?: string;
  page?: number;
  pageSize?: number;
};

export async function listUserStories(
  userId: string,
  filters: StoryListFilters = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const where: Prisma.StoryWhereInput = {
    userId,
    ...(filters.status && filters.status !== "ALL"
      ? { status: filters.status }
      : {}),
    ...(filters.genre ? { genre: { equals: filters.genre, mode: "insensitive" } } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, stories] = await Promise.all([
    prisma.story.count({ where }),
    prisma.story.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            characters: true,
            writingRules: true,
            relationships: true,
          },
        },
      },
    }),
  ]);

  return {
    stories,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOwnedStoryDetail(userId: string, storyId: string) {
  return prisma.story.findFirst({
    where: { id: storyId, userId },
    include: {
      characters: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: {
              outgoingRelationships: true,
              incomingRelationships: true,
            },
          },
        },
      },
      relationships: {
        include: {
          sourceCharacter: true,
          targetCharacter: true,
        },
        orderBy: { createdAt: "asc" },
      },
      writingRules: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }] },
      _count: {
        select: { characters: true, relationships: true, writingRules: true },
      },
    },
  });
}

export async function countUserStories(userId: string) {
  return prisma.story.count({ where: { userId } });
}

export async function countUserStoriesByStatus(
  userId: string,
  status: StoryStatus
) {
  return prisma.story.count({ where: { userId, status } });
}
