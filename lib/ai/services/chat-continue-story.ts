import { prisma } from "@/lib/db";
import {
  assessContinueInstruction,
  buildRevisionInstruction,
} from "@/lib/chat/continue-story-intent";
import type { GenerationAction } from "@prisma/client";

type GenerateEpisodeDraftResult = {
  clientRequestId: string;
  title: string;
  content: string;
  wordCount: number;
  provider: string;
  model: string;
  durationMs: number;
  action: GenerationAction;
  replaceEpisodeId?: string;
};

type GenerateEpisodeDraftFn = (params: {
  userId: string;
  storyId: string;
  userInstruction: string;
  action: GenerationAction;
  clientRequestId: string;
  toneOverride?: string;
  lengthOverride?: string;
  sourceEpisodeId?: string;
}) => Promise<GenerateEpisodeDraftResult>;

export type ContinueChatTurnResult =
  | {
      status: "needs_more_info";
      assistantReply: string;
      followUpQuestion: string;
      action: GenerationAction;
    }
  | {
      status: "draft";
      assistantReply: string;
      action: GenerationAction;
      proposedEpisodeNumber: number;
      draft: GenerateEpisodeDraftResult;
    };

export async function runContinueStoryChatTurn(params: {
  userId: string;
  storyId: string;
  instruction: string;
  clientRequestId: string;
  hasSavedEpisodes: boolean;
  sourceEpisodeId?: string;
  forceAction?: GenerationAction;
  /** When revising an unsaved draft, pass the prior instruction + revision text. */
  revisionOfInstruction?: string;
  generate?: GenerateEpisodeDraftFn;
}): Promise<ContinueChatTurnResult> {
  const instructionForIntent = params.revisionOfInstruction
    ? buildRevisionInstruction({
        baseInstruction: params.revisionOfInstruction,
        revision: params.instruction,
      })
    : params.instruction;

  const intent = assessContinueInstruction(instructionForIntent, {
    hasSavedEpisodes: params.hasSavedEpisodes,
    forceAction: params.forceAction,
  });

  if (intent.status === "needs_more_info") {
    return {
      status: "needs_more_info",
      assistantReply:
        intent.assistantReply ||
        "I need a clearer instruction for the next episode.",
      followUpQuestion:
        intent.followUpQuestion ||
        "What should happen next, and which characters should appear?",
      action: intent.action,
    };
  }

  let action = intent.action;
  let sourceEpisodeId = params.sourceEpisodeId;

  if (
    (action === "REGENERATE" ||
      action === "IMPROVE_WRITING" ||
      action === "MORE_ROMANTIC" ||
      action === "MORE_EMOTIONAL" ||
      action === "ADD_COMEDY") &&
    !sourceEpisodeId
  ) {
    action = params.hasSavedEpisodes ? "CONTINUE" : "NEW_EPISODE";
    sourceEpisodeId = undefined;
  }

  if (action === "CONTINUE" && !params.hasSavedEpisodes) {
    action = "NEW_EPISODE";
  }

  const generate =
    params.generate ??
    (await import("@/lib/ai/services/generate-episode")).generateEpisodeDraft;
  const draft = await generate({
    userId: params.userId,
    storyId: params.storyId,
    userInstruction: intent.normalizedInstruction,
    action,
    clientRequestId: params.clientRequestId,
    sourceEpisodeId,
  });

  const agg = await prisma.episode.aggregate({
    where: { storyId: params.storyId, generationStatus: "SAVED" },
    _max: { episodeNumber: true },
  });

  let proposedEpisodeNumber = (agg._max.episodeNumber ?? 0) + 1;
  if (draft.replaceEpisodeId) {
    const source = await prisma.episode.findFirst({
      where: { id: draft.replaceEpisodeId, storyId: params.storyId },
      select: { episodeNumber: true },
    });
    if (source) proposedEpisodeNumber = source.episodeNumber;
  }

  return {
    status: "draft",
    assistantReply:
      "Here’s an unsaved episode draft based on your instruction and the existing story context. Edit, regenerate, revise, or save when ready.",
    action: draft.action,
    proposedEpisodeNumber,
    draft,
  };
}
