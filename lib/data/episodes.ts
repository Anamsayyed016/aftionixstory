import "server-only";

import { prisma } from "@/lib/db";

export async function listStoryEpisodes(userId: string, storyId: string) {
  return prisma.episode.findMany({
    where: {
      storyId,
      story: { userId },
      generationStatus: "SAVED",
    },
    orderBy: { episodeNumber: "asc" },
    select: {
      id: true,
      episodeNumber: true,
      title: true,
      summary: true,
      wordCount: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      generationAction: true,
    },
  });
}

export async function getOwnedEpisode(
  userId: string,
  storyId: string,
  episodeId: string
) {
  return prisma.episode.findFirst({
    where: {
      id: episodeId,
      storyId,
      story: { userId },
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 50,
      },
      story: {
        select: {
          id: true,
          title: true,
          userId: true,
          status: true,
        },
      },
    },
  });
}

export async function getAdjacentEpisodes(
  storyId: string,
  episodeNumber: number
) {
  const [previous, next] = await Promise.all([
    prisma.episode.findFirst({
      where: {
        storyId,
        generationStatus: "SAVED",
        episodeNumber: { lt: episodeNumber },
      },
      orderBy: { episodeNumber: "desc" },
      select: { id: true, episodeNumber: true, title: true },
    }),
    prisma.episode.findFirst({
      where: {
        storyId,
        generationStatus: "SAVED",
        episodeNumber: { gt: episodeNumber },
      },
      orderBy: { episodeNumber: "asc" },
      select: { id: true, episodeNumber: true, title: true },
    }),
  ]);
  return { previous, next };
}

export async function loadGenerationContext(storyId: string) {
  const story = await prisma.story.findUniqueOrThrow({
    where: { id: storyId },
    include: {
      characters: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      relationships: {
        include: {
          sourceCharacter: { select: { name: true, status: true } },
          targetCharacter: { select: { name: true, status: true } },
        },
      },
      writingRules: {
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      },
      episodes: {
        where: { generationStatus: "SAVED" },
        orderBy: { episodeNumber: "desc" },
        take: 6,
        select: {
          id: true,
          episodeNumber: true,
          title: true,
          content: true,
          summary: true,
        },
      },
    },
  });

  const latest = story.episodes[0] ?? null;
  const recentSummaries = story.episodes
    .slice(latest ? 1 : 0, latest ? 6 : 5)
    .map((e) => ({
      episodeNumber: e.episodeNumber,
      title: e.title,
      summary: e.summary,
    }));

  return { story, latest, recentSummaries };
}
