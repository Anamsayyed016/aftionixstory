"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { toFriendlyAiActionError } from "@/lib/ai/action-errors";
import { isAIError } from "@/lib/ai/errors";
import { readMemoryFromConversationState } from "@/lib/ai/services/story-agent";
import {
  memoryStatusForOperation,
  runStoryOperation,
} from "@/lib/ai/services/run-story-operation";
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
import { extractStoryConcept } from "@/lib/story-agent/concept-reply";
import {
  friendlyMessageForCode,
  isStoryAgentError,
  type StoryAgentErrorCode,
} from "@/lib/story-agent/errors";
import type { StoryMemory } from "@/lib/story-agent/schema";
import type { StoryOperation } from "@/lib/story-agent/operations";
import {
  assertGenerationRateLimit,
  RateLimitError,
  UsageLimitError,
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
  resultType: "conversation" | "creative_draft" | "structured_action" | "error";
  operation: StoryOperation;
  intent: string;
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
    draftKind?: "scene" | "episode" | "rewrite";
    saved?: false;
  } | null;
  actionType: string;
  actionOk: boolean;
  requiresConfirmation: boolean;
  duplicated: boolean;
  outputMode?: string;
  provider?: string;
  model?: string;
  errorCode?: string;
  retryable?: boolean;
};

function mapError(error: unknown): ActionResult<never> {
  if (error instanceof UsageLimitError) {
    return fail(
      "GENERATION_LIMIT_REACHED",
      friendlyMessageForCode("GENERATION_LIMIT_REACHED")
    );
  }
  if (error instanceof RateLimitError) {
    return fail(
      "AI_RATE_LIMITED",
      friendlyMessageForCode("PROVIDER_RATE_LIMITED")
    );
  }
  if (isStoryAgentError(error)) {
    return fail(
      error.code,
      friendlyMessageForCode(error.code, error.operation)
    );
  }
  const ai = toFriendlyAiActionError(error);
  if (ai) return ai;
  if (isAIError(error)) {
    const codeMap: Record<string, StoryAgentErrorCode> = {
      AI_TIMEOUT: "PROVIDER_TIMEOUT",
      AI_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
      AI_QUOTA_EXCEEDED: "PROVIDER_QUOTA_EXCEEDED",
      AI_NOT_CONFIGURED: "PROVIDER_AUTH_FAILED",
      AI_INVALID_MODEL: "MODEL_UNAVAILABLE",
      AI_INVALID_RESPONSE: "AGENT_RESPONSE_INVALID",
    };
    const mapped = codeMap[error.code] || "UNKNOWN_AI_ERROR";
    return fail(error.code, friendlyMessageForCode(mapped));
  }
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
      friendlyMessageForCode("PROVIDER_AUTH_FAILED")
    );
  }

  console.error(
    JSON.stringify({
      event: "story_agent.unmapped_error",
      name: error instanceof Error ? error.name : "unknown",
      message:
        error instanceof Error ? error.message.slice(0, 160) : "non_error",
    })
  );

  return fail(
    "UNKNOWN_AI_ERROR",
    friendlyMessageForCode("UNKNOWN_AI_ERROR")
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
    agentVersion: "2",
    draftForm: previous.draftForm,
    extraction: previous.extraction,
  };
}

/**
 * Canonical Story Agent turn — operation-routed orchestration.
 * Persists user message → route → provider → memory/draft → assistant message.
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
    const messageFingerprint = extractStoryConcept(message).fingerprint;
    const userRequestId = `t_${turnRequestId}_u`;
    const assistantRequestId = `t_${turnRequestId}_a`;
    const turnStartedAt = Date.now();

    console.info(
      JSON.stringify({
        event: "story_agent.turn_start",
        conversationId,
        turnRequestId,
        messageFingerprint,
        messageLength: message.length,
        messagePreview: message.slice(0, 48),
      })
    );

    await assertGenerationRateLimit(user.id);

    const conversation = await requireOwnedConversation(
      user.id,
      conversationId
    );

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
        resultType: memory.latestDraft?.content
          ? "creative_draft"
          : "conversation",
        operation: "conversational_chat",
        intent: "chat",
        suggestions: [],
        memoryStatus: memoryStatusForOperation(
          memory,
          "conversational_chat",
          Boolean(memory.latestDraft?.content)
        ),
        showReview: false,
        storyId: conversation.storyId,
        memory,
        draft: memory.latestDraft?.content
          ? {
              title: memory.latestDraft.title || "Draft",
              content: memory.latestDraft.content,
              wordCount: memory.latestDraft.wordCount || 0,
              clientRequestId: memory.latestDraft.clientRequestId || "",
              draftKind: "scene",
              saved: false,
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

    let turn;
    try {
      turn = await runStoryOperation({
        userId: user.id,
        conversationId,
        storyId: conversation.storyId,
        memory,
        userMessage: message,
        recentMessages: recent,
        turnRequestId,
      });
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Something went wrong reaching the story assistant. Please try again.";
      // Avoid legacy “unreadable response” for creative failures
      const friendly =
        /unreadable/i.test(errMsg)
          ? "I couldn’t complete that request. Please try again."
          : errMsg;
      await appendOwnedChatMessage({
        userId: user.id,
        conversationId,
        role: "ASSISTANT",
        content: friendly,
        status: "ERROR",
        requestId: assistantRequestId,
      });
      throw error;
    }

    const nextStoryId = turn.storyId ?? conversation.storyId;
    const statePayload = buildPersistedState({
      previous: conversation.state,
      memory: turn.memory,
      storyId: nextStoryId,
    });

    await updateOwnedConversationState({
      userId: user.id,
      conversationId,
      state: statePayload as Prisma.InputJsonValue,
      storyId: turn.storyId ?? undefined,
      title: turn.memory.storyMemory.title || undefined,
    });

    const buildId =
      process.env.STORYVERSE_BUILD_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local-dev";

    const assistantStatus =
      turn.resultType === "error" ? ("ERROR" as const) : undefined;

    const appendedAssistant = await appendOwnedChatMessage({
      userId: user.id,
      conversationId,
      role: "ASSISTANT",
      content: turn.assistantReply,
      status: assistantStatus,
      requestId: assistantRequestId,
      metadata: {
        flow: "story_agent",
        agentVersion: "2",
        buildId,
        resultType: turn.resultType,
        operation: turn.operation,
        actionType: turn.actionType,
        actionOk: turn.actionOk,
        provider: turn.provider,
        model: turn.model,
        outputMode: turn.outputMode,
        durationMs: turn.durationMs,
        retryCount: turn.retryCount ?? 0,
      } as Prisma.InputJsonValue,
    });

    console.info(
      JSON.stringify({
        event: "story_agent.turn",
        buildId,
        flow: "story_agent",
        agentVersion: "2",
        resultType: turn.resultType,
        operation: turn.operation,
        detectedIntent: turn.operation,
        selectedOperation: turn.operation,
        actionType: turn.actionType,
        actionOk: turn.actionOk,
        provider: turn.provider,
        model: turn.model,
        outputMode: turn.outputMode,
        providerResultValid: turn.resultType !== "error",
        hasDraft: Boolean(turn.draft),
        conversationId,
        turnRequestId,
        messageFingerprint,
        messageLength: message.length,
        persistedUserMessageId: appendedUser.message.id,
        persistedAssistantMessageId: appendedAssistant.message.id,
        durationMs: Date.now() - turnStartedAt,
        timestamp: new Date().toISOString(),
      })
    );

    return ok({
      conversationId,
      assistantReply: turn.assistantReply,
      resultType: turn.resultType,
      operation: turn.operation,
      intent: turn.operation,
      suggestions: turn.suggestions,
      memoryStatus: memoryStatusForOperation(
        turn.memory,
        turn.operation,
        Boolean(turn.draft?.content)
      ),
      showReview: turn.showReview,
      storyId: nextStoryId,
      memory: turn.memory,
      draft: turn.draft
        ? {
            title: turn.draft.title || "Draft",
            content: turn.draft.content,
            wordCount: turn.draft.wordCount,
            clientRequestId: turn.draft.clientRequestId,
            draftKind: turn.draft.draftKind,
            saved: false,
          }
        : null,
      actionType: turn.actionType,
      actionOk: turn.actionOk,
      requiresConfirmation: turn.requiresConfirmation,
      duplicated: false,
      outputMode: turn.outputMode,
      provider: turn.provider,
      model: turn.model,
    });
  } catch (error) {
    return mapError(error);
  }
}
