/**
 * Conversation Brain — Phase 0 + Phase A orchestrator.
 */

import "server-only";

import { logAiEvent } from "@/lib/ai/logger";
import { runStoryOperation } from "@/lib/ai/services/run-story-operation";
import { extractMentionedCharacters } from "@/lib/ai/context/story-context-builder";
import {
  DEFAULT_CONVERSATION_FLOW,
  mergeConversationFlow,
  type ConversationFlow,
} from "@/lib/conversation-brain/collaboration-state";
import { searchMemory } from "@/lib/conversation-brain/memory-search";
import { planConversationTurnAsync } from "@/lib/conversation-brain/planner";
import {
  runAwaitingResolutionTurn,
  runCollaborativeBrainstormTurn,
  runOfferResolutionTurn,
} from "@/lib/conversation-brain/phase-a-turn";
import { executeBrainTools } from "@/lib/conversation-brain/tools";
import {
  BRAIN_VERSION,
  type ConversationTurnRequest,
  type ConversationTurnResult,
} from "@/lib/conversation-brain/types";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import { summarizeMemoryForLogs } from "@/lib/story-memory/v2";
import {
  buildContextRequestFromPlan,
  buildDynamicContext,
  isDynamicContextV2Enabled,
  summarizeContextForLogs,
} from "@/lib/context-builder/v2";
import { maybeDecorateChatReply, readStyleProfile } from "@/lib/story-agent/style-profile";
import { runToolFrameworkTurn } from "@/lib/tools/brain-adapter";
import { isStoryToolFrameworkEnabled } from "@/lib/tools/feature-flag";

function baseFlow(request: ConversationTurnRequest): ConversationFlow {
  return request.conversationFlow ?? { ...DEFAULT_CONVERSATION_FLOW, lastOffers: [] };
}

/**
 * Run one conversation turn through the Brain pipeline.
 */
export async function runConversationTurn(
  request: ConversationTurnRequest
): Promise<ConversationTurnResult> {
  const started = Date.now();
  let flow = baseFlow(request);

  const plan = await planConversationTurnAsync(
    request.userMessage,
    request.memory,
    flow,
    {
      storyId: request.storyId,
      recentMessages: request.recentMessages,
      turnRequestId: request.turnRequestId,
    }
  );

  const memorySummary = summarizeMemoryForLogs(getMemoryV2(request.memory));
  logAiEvent("info", "conversation_brain.plan", {
    requestId: request.turnRequestId,
    conversationId: request.conversationId,
    intent: plan.intent,
    storyIntent: plan.storyIntent,
    operation: plan.operation,
    confidence: plan.confidence,
    needsMemory: plan.needsMemory,
    needsCreativeGeneration: plan.needsCreativeGeneration,
    deterministicHandled: plan.deterministicHandled,
    aiRequired: plan.aiRequired,
    plannerSource: plan.plannerSource,
    intentSource: plan.intentSource,
    collaborationMode: Boolean(plan.collaborationMode),
    generationBlocked: flow.generationBlocked,
    brainVersion: BRAIN_VERSION,
    memoryVersion: memorySummary.memoryVersion,
    characterCount: memorySummary.characterCount,
    relationshipCount: memorySummary.relationshipCount,
    openThreadCount: memorySummary.openThreadCount,
    hasLatestDraft: memorySummary.hasLatestDraft,
    memoryRevision: memorySummary.revision,
  });

  const mentioned = extractMentionedCharacters(request.userMessage).map(
    (c) => c.name
  );
  const memorySlice = searchMemory(request.memory, {
    intent: plan.intent,
    userMessage: request.userMessage,
    mentionedNames: mentioned,
  });

  logAiEvent("info", "conversation_brain.memory_search", {
    requestId: request.turnRequestId,
    conversationId: request.conversationId,
    intent: plan.intent,
    sectionCount: memorySlice.sectionLabels.length,
    characterCount: memorySlice.characters.length,
  });

  // Phase D: build operation-scoped dynamic context (log only + for downstream prompts via buildStoryContext)
  if (isDynamicContextV2Enabled()) {
    try {
      const dyn = buildDynamicContext(
        buildContextRequestFromPlan({
          intent: plan.storyIntent || plan.intent,
          operation: plan.operation,
          userMessage: request.userMessage,
          memory: getMemoryV2(request.memory),
          recentMessages: request.recentMessages,
          conversationFlow: flow,
          entities: plan.intentRoute?.entities || {
            characterNames: mentioned,
            episodeNumber: null,
            requestedTone: null,
            requestedLanguage: null,
          },
          conversationId: request.conversationId,
          storyId: request.storyId,
        })
      );
      const ctxSummary = summarizeContextForLogs(dyn);
      logAiEvent("info", "conversation_brain.dynamic_context", {
        requestId: request.turnRequestId,
        conversationId: request.conversationId,
        operation: ctxSummary.operation,
        characterCount: ctxSummary.characterCount,
        relationshipCount: ctxSummary.relationshipCount,
        eventCount: ctxSummary.eventCount,
        estimatedTokens: ctxSummary.estimatedTokens,
        truncated: ctxSummary.truncated,
        truncatedDraft: ctxSummary.truncatedDraft,
        hasLatestDraft: ctxSummary.hasLatestDraft,
      });
    } catch {
      logAiEvent("warn", "conversation_brain.dynamic_context", {
        requestId: request.turnRequestId,
        conversationId: request.conversationId,
        code: "CONTEXT_BUILD_FAILED",
      });
    }
  }

  await executeBrainTools([]);

  // ---- Phase G: Story Tool Framework (mutations only) ----
  if (isStoryToolFrameworkEnabled()) {
    const toolTurn = await runToolFrameworkTurn({
      request,
      plan,
      flow,
      started,
    });
    if (toolTurn) {
      return toolTurn;
    }
  }

  // ---- Phase B: clarification without creative/provider failure ----
  if (plan.needsClarification && plan.question && !plan.offerResolution) {
    flow = mergeConversationFlow(flow, {
      lastIntent: plan.intent,
    });
    const style = readStyleProfile({
      emojiStyle: request.memory.userPreferences.emojiStyle,
    });
    return {
      resultType: "conversation",
      operation: "conversational_chat",
      assistantReply: maybeDecorateChatReply(plan.question, style.emojiStyle),
      suggestions: [
        { label: "Write a scene", prompt: "Write a short opening scene." },
        { label: "Brainstorm ideas", prompt: "Suggest three unique story ideas." },
      ],
      memory: request.memory,
      storyId: request.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
      plan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: flow,
    };
  }

  // ---- Phase A: clear generation block ----
  if (plan.clearGenerationBlock) {
    flow = mergeConversationFlow(flow, {
      generationBlocked: false,
      phase: "ready_to_write",
      lastIntent: plan.intent,
      lastOffers: [],
      lastOfferType: "none",
      awaiting: { type: "none", topic: "none" },
    });
    const style = readStyleProfile({
      emojiStyle: request.memory.userPreferences.emojiStyle,
    });
    const memory = {
      ...request.memory,
      userPreferences: {
        ...request.memory.userPreferences,
        doNotStartYet: false,
      },
      updatedAt: new Date().toISOString(),
    };
    return {
      resultType: "conversation",
      operation: "conversational_chat",
      assistantReply: maybeDecorateChatReply(
        "Theek hai ✨ Ab ready hain. Jab chaho “write a scene” ya “start the story” bolo—main usi moment se likhna shuru karungi.",
        style.emojiStyle
      ),
      suggestions: [
        { label: "Write a scene", prompt: "Write a short opening scene." },
        { label: "Start the story", prompt: "Start the story now." },
      ],
      memory,
      storyId: request.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
      plan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: flow,
    };
  }

  // ---- Phase A: blocked creative attempt ----
  if (
    plan.matchedSignals.includes("generation_blocked") &&
    plan.deterministicHandled
  ) {
    flow = mergeConversationFlow(flow, {
      generationBlocked: true,
      lastIntent: plan.intent,
    });
    const style = readStyleProfile({
      emojiStyle: request.memory.userPreferences.emojiStyle,
    });
    return {
      resultType: "conversation",
      operation: "conversational_chat",
      assistantReply: maybeDecorateChatReply(
        "Abhi generation pause pe hai—pehle concept/characters polish karte hain. Jab ready ho, “start now” bol dena. ✨",
        style.emojiStyle
      ),
      suggestions: [
        {
          label: "Start now",
          prompt: "Start now",
        },
      ],
      memory: {
        ...request.memory,
        userPreferences: {
          ...request.memory.userPreferences,
          doNotStartYet: true,
        },
      },
      storyId: request.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
      plan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: flow,
    };
  }

  // ---- Phase A: offer / awaiting resolution ----
  if (plan.offerResolution) {
    const turn = runOfferResolutionTurn({
      resolution: plan.offerResolution,
      memory: request.memory,
      flow,
      storyId: request.storyId,
    });
    return {
      ...turn,
      plan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: turn.conversationFlow,
    };
  }

  if (plan.awaitingResolution) {
    const turn = runAwaitingResolutionTurn({
      resolution: plan.awaitingResolution,
      memory: request.memory,
      flow,
      storyId: request.storyId,
    });
    return {
      ...turn,
      plan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: turn.conversationFlow,
    };
  }

  // ---- Phase A: collaborative brainstorm ----
  if (plan.collaborationMode && plan.operation === "brainstorm") {
    const turn = await runCollaborativeBrainstormTurn({
      userId: request.userId,
      conversationId: request.conversationId,
      storyId: request.storyId,
      memory: request.memory,
      userMessage: request.userMessage,
      recentMessages: request.recentMessages,
      turnRequestId: request.turnRequestId,
      flow,
      openConcept: plan.openConcept ?? {
        matched: true,
        kind: "help_create",
        genreHints: [],
        topicLabel: request.userMessage.slice(0, 80),
        preferOfferType: "openings",
      },
    });
    return {
      ...turn,
      plan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: turn.conversationFlow,
    };
  }

  // ---- Existing executor (deterministic prefs/memory, creative, chat) ----
  const turn = await runStoryOperation({
    userId: request.userId,
    conversationId: request.conversationId,
    storyId: request.storyId,
    memory: request.memory,
    userMessage: request.userMessage,
    recentMessages: request.recentMessages,
    turnRequestId: request.turnRequestId,
    intent: plan.storyIntent || plan.intent,
  });

  // Sync flow flags from plan / memory prefs
  const blocked =
    plan.setGenerationBlock === true ||
    Boolean(turn.memory.userPreferences.doNotStartYet) ||
    flow.generationBlocked;

  flow = mergeConversationFlow(flow, {
    generationBlocked: plan.clearGenerationBlock ? false : blocked,
    lastIntent: plan.intent,
    phase:
      plan.intent === "do_not_start"
        ? "exploring"
        : plan.intent === "greeting"
          ? flow.phase
          : flow.phase === "open"
            ? "exploring"
            : flow.phase,
  });

  // Map suggestions into lastOffers when brainstorm came from legacy path
  if (
    turn.operation === "brainstorm" &&
    turn.suggestions.length > 0 &&
    flow.lastOffers.length === 0
  ) {
    flow = mergeConversationFlow(flow, {
      lastOffers: turn.suggestions.slice(0, 4).map((s, i) => ({
        id: `sug_${i}`,
        label: s.label,
        value: s.label.toLowerCase().replace(/\s+/g, "_").slice(0, 48),
        prompt: s.prompt,
      })),
      lastOfferType: "openings",
      awaiting: { type: "choice", topic: "pairing" },
      phase: "exploring",
    });
  }

  logAiEvent("info", "conversation_brain.turn_complete", {
    requestId: request.turnRequestId,
    conversationId: request.conversationId,
    intent: plan.intent,
    operation: turn.operation,
    resultType: turn.resultType,
    durationMs: Date.now() - started,
    brainVersion: BRAIN_VERSION,
    provider: turn.provider,
    model: turn.model,
  });

  return {
    ...turn,
    plan,
    brainVersion: BRAIN_VERSION,
    conversationFlow: flow,
  };
}

export { memoryStatusForOperation } from "@/lib/ai/services/run-story-operation";
