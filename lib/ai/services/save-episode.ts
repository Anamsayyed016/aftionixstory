import "server-only";

import type { GenerationAction, Prisma } from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";

import {
  generateEpisodeSummaryText,
  generateRollingStorySummaryText,
  localFallbackEpisodeSummary,
} from "@/lib/ai/services/generate-summary";
import { countWords } from "@/lib/ai/token-estimator";
import { allocateNextEpisodeNumber } from "@/lib/data/episode-number";
import { prisma } from "@/lib/db";

const MAX_NUMBER_RETRIES = 3;

export type SaveEpisodeResult = {
  episodeId: string;
  episodeNumber: number;
  title: string;
  wordCount: number;
  summary: string | null;
  version: number;
  warning?: string;
};

async function createEpisodeWithNumberRetry(params: {
  storyId: string;
  title: string;
  content: string;
  summary: string | null;
  userInstruction?: string;
  generationAction?: GenerationAction;
  wordCount: number;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const episodeNumber = await allocateNextEpisodeNumber(tx, params.storyId);
        const episode = await tx.episode.create({
          data: {
            storyId: params.storyId,
            episodeNumber,
            title: params.title,
            content: params.content,
            summary: params.summary,
            userInstruction: params.userInstruction,
            generationAction: params.generationAction,
            generationStatus: "SAVED",
            wordCount: params.wordCount,
            version: 1,
          },
        });
        await tx.story.update({
          where: { id: params.storyId },
          data: {
            totalEpisodes: { increment: 1 },
            status: "ACTIVE",
          },
        });
        return episode;
      });
    } catch (error) {
      lastError = error;
      if (
        error instanceof PrismaNS.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not allocate a unique episode number.");
}

export async function saveEpisodeDraft(params: {
  userId: string;
  storyId: string;
  title: string;
  content: string;
  userInstruction?: string;
  generationAction?: GenerationAction;
  clientRequestId?: string;
  replaceEpisodeId?: string;
}): Promise<SaveEpisodeResult> {
  const story = await prisma.story.findFirst({
    where: { id: params.storyId, userId: params.userId },
  });
  if (!story) {
    throw Object.assign(new Error("Story not found."), { code: "NOT_FOUND" });
  }
  if (story.status === "ARCHIVED") {
    throw Object.assign(new Error("Story is archived."), {
      code: "STORY_ARCHIVED",
    });
  }

  const wordCount = countWords(params.content);
  const warnings: string[] = [];

  // Prefer AI summary; never block save on summary failure.
  let episodeSummary: string | null = null;
  const episodeSummaryResult = await generateEpisodeSummaryText({
    storyTitle: story.title,
    genre: story.genre,
    language: story.language,
    episodeTitle: params.title,
    episodeContent: params.content,
  });
  if (episodeSummaryResult.summary) {
    episodeSummary = episodeSummaryResult.summary;
  } else {
    episodeSummary = localFallbackEpisodeSummary(params.title, params.content);
    if (episodeSummaryResult.warning) warnings.push(episodeSummaryResult.warning);
  }

  if (params.replaceEpisodeId) {
    const existing = await prisma.episode.findFirst({
      where: {
        id: params.replaceEpisodeId,
        storyId: params.storyId,
        story: { userId: params.userId },
      },
    });
    if (!existing) {
      throw Object.assign(new Error("Episode not found."), { code: "NOT_FOUND" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.episodeVersion.create({
        data: {
          episodeId: existing.id,
          versionNumber: existing.version,
          title: existing.title,
          content: existing.content,
          summary: existing.summary,
          changeReason: "regenerate_replace",
        },
      });
      return tx.episode.update({
        where: { id: existing.id },
        data: {
          title: params.title,
          content: params.content,
          summary: episodeSummary,
          userInstruction: params.userInstruction,
          generationAction: params.generationAction,
          wordCount,
          version: { increment: 1 },
          generationStatus: "SAVED",
        },
      });
    });

    const rolling = await generateRollingStorySummaryText({
      storyTitle: story.title,
      genre: story.genre,
      language: story.language,
      previousStorySummary: story.currentSummary,
      newEpisodeSummary: episodeSummary,
      initialPlot: story.initialPlot,
    });
    if (rolling.summary) {
      await prisma.story.update({
        where: { id: story.id },
        data: { currentSummary: rolling.summary },
      });
    } else if (rolling.warning) {
      warnings.push(rolling.warning);
    }

    if (params.clientRequestId) {
      await prisma.generationLog
        .updateMany({
          where: {
            userId: params.userId,
            requestId: params.clientRequestId,
          },
          data: { episodeId: updated.id },
        })
        .catch(() => undefined);
    }

    return {
      episodeId: updated.id,
      episodeNumber: updated.episodeNumber,
      title: updated.title,
      wordCount: updated.wordCount,
      summary: updated.summary,
      version: updated.version,
      warning: warnings.length ? warnings.join(" ") : undefined,
    };
  }

  const episode = await createEpisodeWithNumberRetry({
    storyId: params.storyId,
    title: params.title,
    content: params.content,
    summary: episodeSummary,
    userInstruction: params.userInstruction,
    generationAction: params.generationAction,
    wordCount,
  });

  const rolling = await generateRollingStorySummaryText({
    storyTitle: story.title,
    genre: story.genre,
    language: story.language,
    previousStorySummary: story.currentSummary,
    newEpisodeSummary: episodeSummary,
    initialPlot: story.initialPlot,
  });
  if (rolling.summary) {
    await prisma.story.update({
      where: { id: story.id },
      data: { currentSummary: rolling.summary },
    });
  } else if (rolling.warning) {
    warnings.push(rolling.warning);
  }

  if (params.clientRequestId) {
    await prisma.generationLog
      .updateMany({
        where: {
          userId: params.userId,
          requestId: params.clientRequestId,
        },
        data: { episodeId: episode.id },
      })
      .catch(() => undefined);
  }

  return {
    episodeId: episode.id,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    wordCount: episode.wordCount,
    summary: episode.summary,
    version: episode.version,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}

export async function updateSavedEpisode(params: {
  userId: string;
  episodeId: string;
  title: string;
  content: string;
  changeReason?: string;
}): Promise<SaveEpisodeResult> {
  const episode = await prisma.episode.findFirst({
    where: {
      id: params.episodeId,
      story: { userId: params.userId },
    },
    include: { story: true },
  });
  if (!episode) {
    throw Object.assign(new Error("Episode not found."), { code: "NOT_FOUND" });
  }

  const wordCount = countWords(params.content);
  const warnings: string[] = [];

  let episodeSummary: string | null = episode.summary;
  const summaryResult = await generateEpisodeSummaryText({
    storyTitle: episode.story.title,
    genre: episode.story.genre,
    language: episode.story.language,
    episodeTitle: params.title,
    episodeContent: params.content,
  });
  if (summaryResult.summary) {
    episodeSummary = summaryResult.summary;
  } else if (summaryResult.warning) {
    warnings.push(summaryResult.warning);
    // Keep previous summary (stale) rather than discarding edit.
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.episodeVersion.create({
      data: {
        episodeId: episode.id,
        versionNumber: episode.version,
        title: episode.title,
        content: episode.content,
        summary: episode.summary,
        changeReason: params.changeReason || "manual_edit",
      },
    });
    return tx.episode.update({
      where: { id: episode.id },
      data: {
        title: params.title,
        content: params.content,
        summary: episodeSummary,
        wordCount,
        version: { increment: 1 },
      },
    });
  });

  const rolling = await generateRollingStorySummaryText({
    storyTitle: episode.story.title,
    genre: episode.story.genre,
    language: episode.story.language,
    previousStorySummary: episode.story.currentSummary,
    newEpisodeSummary: episodeSummary,
    initialPlot: episode.story.initialPlot,
  });
  if (rolling.summary) {
    await prisma.story.update({
      where: { id: episode.storyId },
      data: { currentSummary: rolling.summary },
    });
  } else if (rolling.warning) {
    warnings.push(rolling.warning);
  }

  return {
    episodeId: updated.id,
    episodeNumber: updated.episodeNumber,
    title: updated.title,
    wordCount: updated.wordCount,
    summary: updated.summary,
    version: updated.version,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}

export async function deleteOwnedEpisode(params: {
  userId: string;
  episodeId: string;
}): Promise<{ warning?: string }> {
  const episode = await prisma.episode.findFirst({
    where: {
      id: params.episodeId,
      story: { userId: params.userId },
    },
    include: { story: true },
  });
  if (!episode) {
    throw Object.assign(new Error("Episode not found."), { code: "NOT_FOUND" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.episode.delete({ where: { id: episode.id } });
    await tx.story.update({
      where: { id: episode.storyId },
      data: {
        totalEpisodes: { decrement: 1 },
      },
    });
  });

  // Rebuild summary outside the delete transaction so content loss cannot roll back.
  const remaining = await prisma.episode.findMany({
    where: { storyId: episode.storyId, generationStatus: "SAVED" },
    orderBy: { episodeNumber: "asc" },
    select: { title: true, summary: true, content: true },
  });

  if (remaining.length === 0) {
    await prisma.story.update({
      where: { id: episode.storyId },
      data: { currentSummary: null, totalEpisodes: 0 },
    });
    return {};
  }

  const combined = remaining
    .map((e, i) => `${i + 1}. ${e.title}: ${e.summary || e.content.slice(0, 180)}`)
    .join("\n");
  const rolling = await generateRollingStorySummaryText({
    storyTitle: episode.story.title,
    genre: episode.story.genre,
    language: episode.story.language,
    previousStorySummary: null,
    newEpisodeSummary: combined.slice(0, 3500),
    initialPlot: episode.story.initialPlot,
  });

  if (rolling.summary) {
    await prisma.story.update({
      where: { id: episode.storyId },
      data: { currentSummary: rolling.summary },
    });
    return {};
  }

  await prisma.story.update({
    where: { id: episode.storyId },
    data: { currentSummary: null },
  });
  return {
    warning:
      rolling.warning ||
      "Episode deleted. Story summary could not be rebuilt and was cleared.",
  };
}

export type { Prisma };
