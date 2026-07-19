"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { toFriendlyAiActionError } from "@/lib/ai/action-errors";
import {
  mergeDecisionIntoMemory,
  readMemoryFromConversationState,
  runStoryAgentDecision,
} from "@/lib/ai/services/story-agent";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  AuthzError,
  authzToActionError,
  requireAuthenticatedUser,
} from "@/lib/auth/authorization";
import {
  ConversationAccessError,
  appendOwnedChatMessage,
  loadOwnedConversationMessages,
  requireOwnedConversation,
  updateOwnedConversationState,
} from "@/lib/chat/conversations";
import { routeStoryAgentAction } from "@/lib/story-agent/action-router";
import { shouldBlockGeneration } from "@/lib/story-agent/intent";
import { describeMemoryStatus } from "@/lib/story-agent/memory-patch";
import type { StoryAgentTurnResult, StoryMemory } from "@/lib/story-agent/schema";
import {
  assertGenerationRateLimit,
  assertWithinGenerationLimit,
} from "@/lib/usage/generation";

const storyAgentTurnInputSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
  turnRequestId: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export type StoryAgentTurnActionData = {
  conversationId: string;
  assistantReply: string;
  intent: StoryAgentTurnResult["intent"];
  suggestions: Array<{ label: string; prompt: string }>;
  memoryStatus: string;
  showReview: boolean;
  storyId: string | null;
  memory: StoryMemory;
  draft: {
    title: string;
    content: string;
    wordCount: number;
    clientRequestId: string;
  } | null;
  actionType: string;
  actionOk: boolean;
  requiresConfirmation: boolean;
  duplicated: boolean;
};

function mapError(error: unknown): ActionResult<never> {
  const ai = toFriendlyAiActionError(error);
  if (ai) return ai;
  if (error instanceof ConversationAccessError) {
    return fail("NOT_FOUND", error.message);
  }
  if (error instanceof AuthzError) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
  if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
    return fail(
      "AI_NOT_CONFIGURED",
      "The AI provider is not configured on the server yet."
    );
  }
  return fail(
    "AI_REQUEST_FAILED",
    "Something went wrong with the story assistant. Please try again."
  );
}

function buildPersistedState(params: {
  previous: unknown;
  memory: StoryMemory;
  storyId: string | null;
}) {
  const previous =
    params.previous && typeof params.previous === "object"
      ? (params.previous as Record<string, unknown>)
      : {};

  return {
    ...previous,
    ...params.memory,
    storyId: params.storyId ?? previous.storyId,
    agentVersion: "1",
    // Keep legacy keys lightly synced for older UI paths
    draftForm: previous.draftForm,
    extraction: previous.extraction,
  };
}

/**
 * Server-orchestrated Story Agent turn.
 * Persists user message → provider decision → memory/action → assistant message.
 */
export async function storyAgentTurnAction(
  input: unknown
): Promise<ActionResult<StoryAgentTurnActionData>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = storyAgentTurnInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please enter a valid message.");
    }

    const { conversationId, message, turnRequestId } = parsed.data;
    const userRequestId = `t_${turnRequestId}_u`;
    const assistantRequestId = `t_${turnRequestId}_a`;

    await assertWithinGenerationLimit(user.id);
    await assertGenerationRateLimit(user.id);

    const conversation = await requireOwnedConversation(
      user.id,
      conversationId
    );

    // Idempotency: if assistant for this turn already exists, return it
    const { messages: existingMessages } = await loadOwnedConversationMessages({
      userId: user.id,
      conversationId,
      limit: 50,
    });
    const existingAssistant = existingMessages.find(
      (m) => m.requestId === assistantRequestId
    );
    if (existingAssistant) {
      const memory = readMemoryFromConversationState(conversation.state);
      return ok({
        conversationId,
        assistantReply: existingAssistant.content,
        intent: "chat",
        suggestions: [],
        memoryStatus: describeMemoryStatus(memory),
        showReview: false,
        storyId: conversation.storyId,
        memory,
        draft: memory.latestDraft?.content
          ? {
              title: memory.latestDraft.title || "Draft",
              content: memory.latestDraft.content,
              wordCount: memory.latestDraft.wordCount || 0,
              clientRequestId: memory.latestDraft.clientRequestId || "",
            }
          : null,
        actionType: "none",
        actionOk: true,
        requiresConfirmation: false,
        duplicated: true,
      });
    }

    const appendedUser = await appendOwnedChatMessage({
      userId: user.id,
      conversationId,
      role: "USER",
      content: message,
      requestId: userRequestId,
    });

    const memory = readMemoryFromConversationState(
      appendedUser.conversation.state ?? conversation.state
    );

    const recent = existingMessages
      .concat(appendedUser.duplicated ? [] : [appendedUser.message])
      .slice(-16)
      .map((m) => ({
        role:
          m.role === "ASSISTANT"
            ? ("assistant" as const)
            : ("user" as const),
        content: m.content,
      }));

    // If user message was duplicate but no assistant yet, still proceed once
    let decisionResult;
    try {
      decisionResult = await runStoryAgentDecision({
        userMessage: message,
        memory,
        recentMessages: recent,
        storyId: conversation.storyId,
      });
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Something went wrong reaching the story assistant. Please try again.";
      await appendOwnedChatMessage({
        userId: user.id,
        conversationId,
        role: "ASSISTANT",
        content: errMsg,
        status: "ERROR",
        requestId: assistantRequestId,
      });
      throw error;
    }

    let nextMemory = mergeDecisionIntoMemory(memory, decisionResult.decision);
    const generationBlocked = shouldBlockGeneration({
      intent: decisionResult.decision.intent,
      doNotStartYet: nextMemory.userPreferences.doNotStartYet,
      userMessage: message,
    });

    const routed = await routeStoryAgentAction({
      userId: user.id,
      conversationId,
      storyId: conversation.storyId,
      memory: nextMemory,
      decision: decisionResult.decision,
      userMessage: message,
      turnRequestId,
      generationBlocked,
    });
    nextMemory = routed.memory;

    let assistantReply = decisionResult.decision.assistantReply;
    if (!routed.result.ok && routed.result.message) {
      // Prefer conversational decision reply; append action note only when needed
      if (
        decisionResult.decision.action.type !== "none" &&
        !assistantReply.toLowerCase().includes("won’t start") &&
        !assistantReply.toLowerCase().includes("won't start")
      ) {
        assistantReply = `${assistantReply}\n\n${routed.result.message}`;
      }
    }
    if (
      routed.result.ok &&
      routed.result.draft &&
      decisionResult.decision.action.type !== "none"
    ) {
      // Keep reply natural; draft is returned separately for UI
    }

    const nextStoryId = routed.result.storyId ?? conversation.storyId;
    const statePayload = buildPersistedState({
      previous: conversation.state,
      memory: nextMemory,
      storyId: nextStoryId,
    });

    await updateOwnedConversationState({
      userId: user.id,
      conversationId,
      state: statePayload as Prisma.InputJsonValue,
      storyId: routed.result.storyId ?? undefined,
      title: nextMemory.storyMemory.title || undefined,
    });

    await appendOwnedChatMessage({
      userId: user.id,
      conversationId,
      role: "ASSISTANT",
      content: assistantReply,
      requestId: assistantRequestId,
      metadata: {
        intent: decisionResult.decision.intent,
        actionType: routed.result.type,
        actionOk: routed.result.ok,
        provider: decisionResult.provider,
        model: decisionResult.model,
        durationMs: decisionResult.durationMs,
      } as Prisma.InputJsonValue,
    });

    return ok({
      conversationId,
      assistantReply,
      intent: decisionResult.decision.intent,
      suggestions:
        routed.result.suggestions ??
        decisionResult.decision.suggestions ??
        [],
      memoryStatus: describeMemoryStatus(nextMemory),
      showReview: Boolean(routed.result.showReview),
      storyId: nextStoryId,
      memory: nextMemory,
      draft: routed.result.draft
        ? {
            title: routed.result.draft.title,
            content: routed.result.draft.content,
            wordCount: routed.result.draft.wordCount,
            clientRequestId: routed.result.draft.clientRequestId,
          }
        : nextMemory.latestDraft?.content
          ? {
              title: nextMemory.latestDraft.title || "Draft",
              content: nextMemory.latestDraft.content,
              wordCount: nextMemory.latestDraft.wordCount || 0,
              clientRequestId: nextMemory.latestDraft.clientRequestId || "",
            }
          : null,
      actionType: routed.result.type,
      actionOk: routed.result.ok,
      requiresConfirmation: decisionResult.decision.requiresConfirmation,
      duplicated: false,
    });
  } catch (error) {
    return mapError(error);
  }
}
