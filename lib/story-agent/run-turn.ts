import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { toFriendlyAiActionError } from "@/lib/ai/action-errors";
import { isAIError } from "@/lib/ai/errors";
import { readMemoryFromConversationState } from "@/lib/ai/services/story-agent";
import {
  memoryStatusForOperation,
  runConversationTurn,
} from "@/lib/conversation-brain/server";
import { readConversationFlow } from "@/lib/conversation-brain";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
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
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import {
  buildCanonicalStoryContext,
  readCanonicalStoryContext,
  type CanonicalStoryContext,
} from "@/lib/story-agent/canonical-story-context";
import { memoryV2ToPersistedState } from "@/lib/story-memory/v2";
import type { StoryOperation } from "@/lib/story-agent/operations";
import {
  AuthzError,
  authzToActionError,
} from "@/lib/auth/authorization";
import {
  assertGenerationRateLimit,
  RateLimitError,
  UsageLimitError,
} from "@/lib/usage/generation";
import {
  classifyUniversalIntent,
  isStoryUniversalIntent,
  isUniversalRouterEnabled,
  runGeneralAiTurn,
} from "@/lib/universal-router";
import type { UniversalRouteDecision } from "@/lib/universal-router/intents";

export const storyAgentTurnInputSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
  turnRequestId: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/),
  /** Retry: reuse last USER message instead of appending a duplicate. */
  reuseLastUserMessage: z.boolean().optional().default(false),
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

export function mapStoryAgentTurnError(error: unknown): ActionResult<never> {
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
  conversationFlow?: unknown;
  canonicalStoryContext: CanonicalStoryContext;
}) {
  const previous =
    params.previous && typeof params.previous === "object"
      ? (params.previous as Record<string, unknown>)
      : {};

  const v2 = getMemoryV2(params.memory);
  const memoryBlob = memoryV2ToPersistedState(v2);

  return {
    ...previous,
    ...memoryBlob,
    storyId: params.storyId ?? previous.storyId,
    agentVersion: "2",
    brainVersion: "0",
    memoryVersion: 2,
    conversationFlow:
      params.conversationFlow ?? previous.conversationFlow ?? undefined,
    canonicalStoryContext: params.canonicalStoryContext,
    draftForm: previous.draftForm,
    extraction: previous.extraction,
  };
}

export type StoryAgentTurnInput = z.infer<typeof storyAgentTurnInputSchema> & {
  userId: string;
};

/**
 * Canonical Story Agent turn — operation-routed orchestration.
 * Persists user message → route → provider → memory/draft → assistant message.
 *
 * Shared by the `storyAgentTurnAction` Server Action (non-streaming) and the
 * `/api/chat/stream` Route Handler (chunked pseudo-streaming). Callers own
 * authentication themselves — this function trusts the `userId` it's given.
 */
export async function runStoryAgentTurn(
  input: StoryAgentTurnInput
): Promise<StoryAgentTurnActionData> {
  const { userId, conversationId, message, turnRequestId, reuseLastUserMessage } =
    input;
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
      reuseLastUserMessage,
      turnState: "RECEIVED",
    })
  );

  await assertGenerationRateLimit(userId);

  const conversation = await requireOwnedConversation(userId, conversationId);

  const { messages: existingMessages } = await loadOwnedConversationMessages({
    userId,
    conversationId,
    limit: 50,
  });
  const existingAssistant = existingMessages.find(
    (m) => m.requestId === assistantRequestId
  );
  if (existingAssistant) {
    const memory = readMemoryFromConversationState(conversation.state);
    return {
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
    };
  }

  let appendedUser: Awaited<ReturnType<typeof appendOwnedChatMessage>>;
  if (reuseLastUserMessage) {
    const lastUser = [...existingMessages]
      .reverse()
      .find((m) => m.role === "USER");
    if (lastUser && lastUser.content.trim() === message.trim()) {
      appendedUser = {
        conversation,
        message: lastUser,
        duplicated: true as const,
      };
    } else {
      appendedUser = await appendOwnedChatMessage({
        userId,
        conversationId,
        role: "USER",
        content: message,
        requestId: userRequestId,
        metadata: {
          turnRequestId,
          turnState: "RECEIVED",
        } as Prisma.InputJsonValue,
      });
    }
  } else {
    appendedUser = await appendOwnedChatMessage({
      userId,
      conversationId,
      role: "USER",
      content: message,
      requestId: userRequestId,
      metadata: {
        turnRequestId,
        turnState: "RECEIVED",
      } as Prisma.InputJsonValue,
    });
  }

  const stateSource = appendedUser.conversation.state ?? conversation.state;
  const memory = readMemoryFromConversationState(stateSource);
  const conversationFlow = readConversationFlow(stateSource);

  const recent = existingMessages
    .concat(appendedUser.duplicated ? [] : [appendedUser.message])
    .slice(-16)
    .map((m) => ({
      role: m.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  const allMessages = existingMessages
    .concat(appendedUser.duplicated ? [] : [appendedUser.message])
    .map((m) => ({
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content,
    }));
  const canonicalStoryContext = buildCanonicalStoryContext({
    conversationId,
    storyId: conversation.storyId,
    memory,
    recentMessages: allMessages,
    latestInstruction: message,
    previous: readCanonicalStoryContext(stateSource),
  });

  let universalDecision: UniversalRouteDecision | null = null;
  if (isUniversalRouterEnabled()) {
    const recentAssistantQuestion = [...recent]
      .reverse()
      .find((m) => m.role === "assistant")
      ?.content?.slice(0, 400);
    universalDecision = await classifyUniversalIntent({
      userMessage: message,
      conversationFlow,
      recentAssistantQuestion,
    });
  }

  if (
    universalDecision &&
    !isStoryUniversalIntent(universalDecision.intent)
  ) {
    let turnState: "ROUTED" | "PROCESSING" | "COMPLETED" | "FAILED" = "ROUTED";
    let generalReply = "";
    let provider: string | undefined;
    let model: string | undefined;
    let durationMs: number | undefined;
    try {
      turnState = "PROCESSING";
      const general = await runGeneralAiTurn({
        userMessage: message,
        intent: universalDecision.intent,
        enableWebSearch: universalDecision.enableWebSearch,
        turnRequestId,
        recentMessages: recent,
      });
      generalReply = general.assistantReply;
      provider = general.provider;
      model = general.model;
      durationMs = general.durationMs;
      turnState = "COMPLETED";
    } catch (error) {
      turnState = "FAILED";
      const errMsg =
        error instanceof Error
          ? error.message
          : "Something went wrong reaching the assistant. Please try again.";
      await appendOwnedChatMessage({
        userId,
        conversationId,
        role: "ASSISTANT",
        content: errMsg,
        status: "ERROR",
        requestId: assistantRequestId,
        metadata: {
          flow: "universal_assistant",
          turnRequestId,
          turnState: "FAILED",
          universalIntent: universalDecision.intent,
          code: isStoryAgentError(error) ? error.code : "UNKNOWN_AI_ERROR",
          retryable: isStoryAgentError(error) ? error.retryable : true,
        } as Prisma.InputJsonValue,
      });
      throw error;
    }

    const statePayload = buildPersistedState({
      previous: conversation.state,
      memory,
      storyId: conversation.storyId,
      conversationFlow,
      canonicalStoryContext,
    });

    await updateOwnedConversationState({
      userId,
      conversationId,
      state: statePayload as Prisma.InputJsonValue,
      storyId: conversation.storyId ?? undefined,
    });

    const buildId =
      process.env.STORYVERSE_BUILD_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "local-dev";

    const appendedAssistant = await appendOwnedChatMessage({
      userId,
      conversationId,
      role: "ASSISTANT",
      content: generalReply,
      requestId: assistantRequestId,
      metadata: {
        flow: "universal_assistant",
        agentVersion: "2",
        buildId,
        resultType: "conversation",
        operation: "conversational_chat",
        actionType: "none",
        actionOk: true,
        provider,
        model,
        outputMode: "text",
        durationMs,
        turnRequestId,
        turnState,
        universalIntent: universalDecision.intent,
        universalConfidence: universalDecision.confidence,
        universalSource: universalDecision.source,
        enableWebSearch: universalDecision.enableWebSearch,
        intent: universalDecision.intent,
      } as Prisma.InputJsonValue,
    });

    console.info(
      JSON.stringify({
        event: "universal_router.turn",
        buildId,
        flow: "universal_assistant",
        universalIntent: universalDecision.intent,
        universalSource: universalDecision.source,
        enableWebSearch: universalDecision.enableWebSearch,
        provider,
        model,
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

    return {
      conversationId,
      assistantReply: generalReply,
      resultType: "conversation",
      operation: "conversational_chat",
      intent: universalDecision.intent,
      suggestions: [],
      memoryStatus: memoryStatusForOperation(memory, "conversational_chat", false),
      showReview: false,
      storyId: conversation.storyId,
      memory,
      draft: null,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      duplicated: false,
      outputMode: "text",
      provider,
      model,
    };
  }

  let turn!: Awaited<ReturnType<typeof runConversationTurn>>;
  let turnState: "ROUTED" | "PROCESSING" | "COMPLETED" | "FAILED" = "ROUTED";
  try {
    turnState = "PROCESSING";
    turn = await runConversationTurn({
      userId,
      conversationId,
      storyId: conversation.storyId,
      memory,
      userMessage: message,
      recentMessages: recent,
      turnRequestId,
      conversationFlow,
      canonicalStoryContext,
    });
    turnState = turn.resultType === "error" ? "FAILED" : "COMPLETED";
  } catch (error) {
    turnState = "FAILED";
    const errMsg =
      error instanceof Error
        ? error.message
        : "Something went wrong reaching the story assistant. Please try again.";
    // Avoid legacy “unreadable response” for creative failures
    const friendly = /unreadable/i.test(errMsg)
      ? "I couldn’t complete that request. Please try again."
      : errMsg;
    await appendOwnedChatMessage({
      userId,
      conversationId,
      role: "ASSISTANT",
      content: friendly,
      status: "ERROR",
      requestId: assistantRequestId,
      metadata: {
        flow: "story_agent",
        turnRequestId,
        turnState: "FAILED",
        code: isStoryAgentError(error) ? error.code : "UNKNOWN_AI_ERROR",
        retryable: isStoryAgentError(error) ? error.retryable : true,
      } as Prisma.InputJsonValue,
    });
    throw error;
  } finally {
    // Ensure we never leave the turn in PROCESSING without a terminal state.
    if (turnState === "PROCESSING") {
      turnState = "FAILED";
    }
  }

  const nextStoryId = turn.storyId ?? conversation.storyId;
  const statePayload = buildPersistedState({
    previous: conversation.state,
    memory: turn.memory,
    storyId: nextStoryId,
    conversationFlow: turn.conversationFlow,
    canonicalStoryContext: buildCanonicalStoryContext({
      conversationId,
      storyId: nextStoryId,
      memory: turn.memory,
      recentMessages: allMessages,
      latestInstruction: message,
      previous: canonicalStoryContext,
    }),
  });

  await updateOwnedConversationState({
    userId,
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
    userId,
    conversationId,
    role: "ASSISTANT",
    content: turn.assistantReply,
    status: assistantStatus,
    requestId: assistantRequestId,
    metadata: {
      flow: "story_agent",
      agentVersion: "2",
      brainVersion: turn.brainVersion,
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
      turnRequestId,
      turnState,
      code: turn.errorCode,
      retryable: turn.retryable,
      planIntent: turn.plan.intent,
      planConfidence: turn.plan.confidence,
      plannerSource: turn.plan.plannerSource,
      aiRequired: turn.plan.aiRequired,
      deterministicHandled: turn.plan.deterministicHandled,
      intent: turn.plan.storyIntent ?? turn.plan.intent,
      intentConfidence: turn.plan.confidence,
      intentSource: turn.plan.intentSource ?? turn.plan.plannerSource,
      promptId: turn.promptId,
      promptVersion: turn.promptVersion,
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

  return {
    conversationId,
    assistantReply: turn.assistantReply,
    resultType: turn.resultType,
    operation: turn.operation,
    intent: turn.plan.intent,
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
  };
}

export async function runStoryAgentTurnAsResult(
  input: StoryAgentTurnInput
): Promise<ActionResult<StoryAgentTurnActionData>> {
  try {
    const data = await runStoryAgentTurn(input);
    return ok(data);
  } catch (error) {
    return mapStoryAgentTurnError(error);
  }
}
