import "server-only";

import type { GenerationAction } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { AIError, isAIError } from "@/lib/ai/errors";
import { buildEpisodePrompt } from "@/lib/ai/prompt-builder";
import { parseEpisodeOutput } from "@/lib/ai/response-parser";
import { countWords } from "@/lib/ai/token-estimator";
import { prisma } from "@/lib/db";
import { loadGenerationContext } from "@/lib/data/episodes";
import { getAiEnv, resolveStoryModel } from "@/lib/env";
import {
  buildGenerationRequestFromSystemPrompt,
  generate as gatewayGenerate,
  generationResultToLegacyText,
  isProviderError,
  isProviderRouterV2Enabled,
} from "@/lib/provider-router/v2";
import {
  assertGenerationRateLimit,
  assertWithinGenerationLimit,
  incrementSuccessfulGeneration,
} from "@/lib/usage/generation";
import { getAIProvider } from "@/lib/ai/registry";

export type GenerateEpisodeDraftResult = {
  clientRequestId: string;
  title: string;
  content: string;
  wordCount: number;
  provider: string;
  model: string;
  durationMs: number;
  action: GenerationAction;
  /** Present when regenerating a saved episode — save should replace, not append. */
  replaceEpisodeId?: string;
};

export class DuplicateGenerationError extends Error {
  code = "DUPLICATE_GENERATION_REQUEST" as const;
  constructor(message = "This generation request was already submitted.") {
    super(message);
    this.name = "DuplicateGenerationError";
  }
}

export async function generateEpisodeDraft(params: {
  userId: string;
  storyId: string;
  userInstruction: string;
  action: GenerationAction;
  clientRequestId: string;
  toneOverride?: string;
  lengthOverride?: string;
  sourceEpisodeId?: string;
}): Promise<GenerateEpisodeDraftResult> {
  await assertWithinGenerationLimit(params.userId);
  await assertGenerationRateLimit(params.userId);

  const existing = await prisma.generationLog.findUnique({
    where: {
      userId_requestId: {
        userId: params.userId,
        requestId: params.clientRequestId,
      },
    },
  });
  if (existing) {
    throw new DuplicateGenerationError();
  }

  const { story, latest, recentSummaries } = await loadGenerationContext(
    params.storyId
  );

  if (story.userId !== params.userId) {
    throw new AIError("AI_REQUEST_FAILED", "Story ownership mismatch.", false);
  }
  if (story.status === "ARCHIVED") {
    const err = new Error("Story is archived.");
    (err as Error & { code: string }).code = "STORY_ARCHIVED";
    throw err;
  }

  let replaceEpisodeId: string | undefined;
  let latestForPrompt = latest;
  let recentForPrompt = recentSummaries;

  if (params.sourceEpisodeId) {
    const source = await prisma.episode.findFirst({
      where: {
        id: params.sourceEpisodeId,
        storyId: params.storyId,
        story: { userId: params.userId },
        generationStatus: "SAVED",
      },
    });
    if (!source) {
      throw new Error("Source episode not found.");
    }
    if (
      params.action === "REGENERATE" ||
      params.action === "IMPROVE_WRITING" ||
      params.action === "MORE_ROMANTIC" ||
      params.action === "MORE_EMOTIONAL" ||
      params.action === "ADD_COMEDY"
    ) {
      replaceEpisodeId = source.id;
      latestForPrompt = {
        id: source.id,
        episodeNumber: source.episodeNumber,
        title: source.title,
        content: source.content,
        summary: source.summary,
      };
      const older = await prisma.episode.findMany({
        where: {
          storyId: params.storyId,
          generationStatus: "SAVED",
          episodeNumber: { lt: source.episodeNumber },
        },
        orderBy: { episodeNumber: "desc" },
        take: 5,
        select: { episodeNumber: true, title: true, summary: true },
      });
      recentForPrompt = older;
    }
  }

  const built = buildEpisodePrompt({
    story,
    characters: story.characters,
    relationships: story.relationships.map((r) => ({
      sourceName: r.sourceCharacter.name,
      targetName: r.targetCharacter.name,
      relationshipType: r.relationshipType,
      description: r.description,
      currentStatus: r.currentStatus,
      emotionalDynamic: r.emotionalDynamic,
      sourceStatus: r.sourceCharacter.status,
      targetStatus: r.targetCharacter.status,
    })),
    writingRules: story.writingRules,
    recentEpisodeSummaries: recentForPrompt,
    latestEpisode: latestForPrompt
      ? {
          episodeNumber: latestForPrompt.episodeNumber,
          title: latestForPrompt.title,
          content: latestForPrompt.content,
        }
      : null,
    userInstruction: params.userInstruction,
    action: params.action,
    toneOverride: params.toneOverride,
    lengthOverride: params.lengthOverride,
    isFirstEpisode: !latestForPrompt,
  });

  const env = getAiEnv();
  const started = Date.now();

  try {
    let result: {
      text: string;
      provider: string;
      model: string;
      durationMs: number;
      inputCharacters: number;
      outputCharacters: number;
      estimatedInputTokens?: number;
      estimatedOutputTokens?: number;
    };

    if (isProviderRouterV2Enabled()) {
      const request = buildGenerationRequestFromSystemPrompt({
        system: built.systemInstruction,
        prompt: built.prompt,
        operation: "generate_episode",
        outputMode: "text",
        turnRequestId: params.clientRequestId,
        temperature: 0.9,
        maxOutputTokens: 4096,
        modelKind: "story",
        promptId: "legacy.generate_episode",
        promptVersion: "0.0.0-legacy",
      });
      const gen = await gatewayGenerate(request);
      result = generationResultToLegacyText(gen);
    } else {
      const provider = getAIProvider();
      result = await provider.generateText({
        systemInstruction: built.systemInstruction,
        prompt: built.prompt,
        temperature: 0.9,
        maxOutputTokens: 4096,
        model: resolveStoryModel(env),
        operation: "generate_episode",
      });
    }

    const parsed = parseEpisodeOutput(
      result.text,
      `Episode ${(latest?.episodeNumber ?? 0) + 1}`
    );
    const wordCount = countWords(parsed.content);

    await prisma.generationLog.create({
      data: {
        userId: params.userId,
        storyId: params.storyId,
        provider: result.provider,
        model: result.model,
        action: params.action,
        inputCharacters: result.inputCharacters,
        outputCharacters: result.outputCharacters,
        estimatedInputTokens: result.estimatedInputTokens,
        estimatedOutputTokens: result.estimatedOutputTokens,
        durationMs: result.durationMs,
        success: true,
        requestId: params.clientRequestId,
      },
    });

    await incrementSuccessfulGeneration(params.userId);

    return {
      clientRequestId: params.clientRequestId,
      title: parsed.title,
      content: parsed.content,
      wordCount,
      provider: result.provider,
      model: result.model,
      durationMs: result.durationMs,
      action: params.action,
      replaceEpisodeId,
    };
  } catch (error) {
    const code = isProviderError(error)
      ? error.code
      : isAIError(error)
        ? error.code
        : "AI_REQUEST_FAILED";
    try {
      await prisma.generationLog.create({
        data: {
          userId: params.userId,
          storyId: params.storyId,
          provider: "unknown",
          model: resolveStoryModel(env),
          action: params.action,
          durationMs: Date.now() - started,
          success: false,
          errorCode: code,
          requestId: params.clientRequestId,
        },
      });
    } catch (logError) {
      if (
        logError instanceof Prisma.PrismaClientKnownRequestError &&
        logError.code === "P2002"
      ) {
        throw new DuplicateGenerationError();
      }
      // Swallow log write failures after primary error
    }
    throw error;
  }
}
