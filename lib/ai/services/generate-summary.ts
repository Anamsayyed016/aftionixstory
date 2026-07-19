import "server-only";

import type { GenerationAction, Prisma } from "@prisma/client";

import { isAIError } from "@/lib/ai/errors";
import { buildSummaryPrompt } from "@/lib/ai/prompt-builder";
import { getAIProvider } from "@/lib/ai/registry";
import { parseSummaryOutput } from "@/lib/ai/response-parser";
import { getAiEnv, resolveSummaryModel } from "@/lib/env";

export async function generateEpisodeSummaryText(params: {
  storyTitle: string;
  genre: string;
  language: string;
  episodeTitle: string;
  episodeContent: string;
}): Promise<{ summary: string; warning?: string }> {
  try {
    const built = buildSummaryPrompt({
      mode: "episode",
      storyTitle: params.storyTitle,
      genre: params.genre,
      language: params.language,
      episodeTitle: params.episodeTitle,
      episodeContent: params.episodeContent,
    });
    const env = getAiEnv();
    const provider = getAIProvider();
    const result = await provider.generateText({
      systemInstruction: built.systemInstruction,
      prompt: built.prompt,
      temperature: 0.4,
      maxOutputTokens: 800,
      model: resolveSummaryModel(env),
      operation: "generate_episode_summary",
    });
    return { summary: parseSummaryOutput(result.text) };
  } catch (error) {
    const code = isAIError(error) ? error.code : "AI_REQUEST_FAILED";
    return {
      summary: "",
      warning: `Episode summary could not be generated (${code}). Episode content was kept.`,
    };
  }
}

export async function generateRollingStorySummaryText(params: {
  storyTitle: string;
  genre: string;
  language: string;
  previousStorySummary?: string | null;
  newEpisodeSummary?: string | null;
  initialPlot?: string | null;
}): Promise<{ summary: string | null; warning?: string }> {
  try {
    const built = buildSummaryPrompt({
      mode: "rolling",
      storyTitle: params.storyTitle,
      genre: params.genre,
      language: params.language,
      previousStorySummary: params.previousStorySummary,
      newEpisodeSummary: params.newEpisodeSummary,
      initialPlot: params.initialPlot,
    });
    const env = getAiEnv();
    const provider = getAIProvider();
    const result = await provider.generateText({
      systemInstruction: built.systemInstruction,
      prompt: built.prompt,
      temperature: 0.3,
      maxOutputTokens: 900,
      model: resolveSummaryModel(env),
      operation: "generate_rolling_summary",
    });
    return { summary: parseSummaryOutput(result.text) };
  } catch (error) {
    const code = isAIError(error) ? error.code : "AI_REQUEST_FAILED";
    return {
      summary: null,
      warning: `Story summary could not be updated (${code}).`,
    };
  }
}

/** Fallback local summary when AI is unavailable — never throws. */
export function localFallbackEpisodeSummary(
  title: string,
  content: string
): string {
  const excerpt = content.replace(/\s+/g, " ").trim().slice(0, 400);
  return `Episode “${title}”: ${excerpt}${content.length > 400 ? "…" : ""}`;
}

export async function rebuildStorySummaryFromEpisodes(params: {
  storyId: string;
  tx?: Prisma.TransactionClient;
}): Promise<{ summary: string | null; warning?: string }> {
  const db = params.tx ?? (await import("@/lib/db")).prisma;
  const story = await db.story.findUniqueOrThrow({
    where: { id: params.storyId },
    select: {
      title: true,
      genre: true,
      language: true,
      initialPlot: true,
      currentSummary: true,
      episodes: {
        where: { generationStatus: "SAVED" },
        orderBy: { episodeNumber: "asc" },
        select: { title: true, summary: true, content: true },
      },
    },
  });

  if (story.episodes.length === 0) {
    return { summary: null };
  }

  const combined = story.episodes
    .map(
      (e, i) =>
        `${i + 1}. ${e.title}: ${e.summary || e.content.slice(0, 200)}`
    )
    .join("\n");

  return generateRollingStorySummaryText({
    storyTitle: story.title,
    genre: story.genre,
    language: story.language,
    previousStorySummary: story.currentSummary,
    newEpisodeSummary: combined.slice(0, 3500),
    initialPlot: story.initialPlot,
  });
}

export type { GenerationAction };
