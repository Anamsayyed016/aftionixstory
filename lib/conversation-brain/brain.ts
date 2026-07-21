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
import { applyInstructionFidelityPreTurn } from "@/lib/story-fidelity/brain-adapter";
import { isInstructionFidelityEnabled } from "@/lib/story-fidelity/feature-flag";

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

  let workingMemory = request.memory;
  let workingPlan = plan;
  let workingRequest = request;

  // ---- Phase G.5: resolve/lock facts + readiness before clarification/tools ----
  if (isInstructionFidelityEnabled()) {
    const fidelity = applyInstructionFidelityPreTurn({
      memory: workingMemory,
      userMessage: request.userMessage,
      plan: workingPlan,
      flow,
      turnRequestId: request.turnRequestId,
    });
    workingMemory = fidelity.memory;
    workingPlan = fidelity.plan;
    flow = fidelity.flow;
    workingRequest = { ...request, memory: workingMemory };

    logAiEvent("info", "story_fidelity.readiness", {
      requestId: request.turnRequestId,
      conversationId: request.conversationId,
      operation: workingPlan.operation,
      ready: fidelity.readiness.ready,
      mode: fidelity.readiness.mode,
      generationAllowed: fidelity.readiness.generationAllowed,
      blockingCount: fidelity.readiness.blockingReasons.length,
      requiredFactCount:
        (fidelity.readiness.resolvedFactsSnapshot?.characters.mainMaleLead
          ? 1
          : 0) +
        (fidelity.readiness.resolvedFactsSnapshot?.characters.mainFemaleLead
          ? 1
          : 0) +
        (fidelity.readiness.resolvedFactsSnapshot?.setting.primarySetting
          ? 1
          : 0),
    });

    if (fidelity.blockCreativeGeneration && fidelity.planningReply) {
      const style = readStyleProfile({
        emojiStyle: workingMemory.userPreferences.emojiStyle,
      });
      return {
        resultType: "conversation",
        operation: "conversational_chat",
        assistantReply: maybeDecorateChatReply(
          fidelity.planningReply,
          style.emojiStyle
        ),
        suggestions: [
          { label: "Start the story", prompt: "Start the story" },
          { label: "Add format rules", prompt: "Character uppercase me aayenge" },
        ],
        memory: workingMemory,
        storyId: request.storyId,
        draft: null,
        showReview: false,
        actionType: "none",
        actionOk: true,
        requiresConfirmation: false,
        outputMode: "structured",
        durationMs: Date.now() - started,
        retryCount: 0,
        plan: workingPlan,
        brainVersion: BRAIN_VERSION,
        conversationFlow: flow,
      };
    }
  }

  const memorySummary = summarizeMemoryForLogs(getMemoryV2(workingMemory));
  logAiEvent("info", "conversation_brain.plan", {
    requestId: request.turnRequestId,
    conversationId: request.conversationId,
    intent: workingPlan.intent,
    storyIntent: workingPlan.storyIntent,
    operation: workingPlan.operation,
    confidence: workingPlan.confidence,
    needsMemory: workingPlan.needsMemory,
    needsCreativeGeneration: workingPlan.needsCreativeGeneration,
    deterministicHandled: workingPlan.deterministicHandled,
    aiRequired: workingPlan.aiRequired,
    plannerSource: workingPlan.plannerSource,
    intentSource: workingPlan.intentSource,
    collaborationMode: Boolean(workingPlan.collaborationMode),
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
  const memorySlice = searchMemory(workingMemory, {
    intent: workingPlan.intent,
    userMessage: request.userMessage,
    mentionedNames: mentioned,
  });

  logAiEvent("info", "conversation_brain.memory_search", {
    requestId: request.turnRequestId,
    conversationId: request.conversationId,
    intent: workingPlan.intent,
    sectionCount: memorySlice.sectionLabels.length,
    characterCount: memorySlice.characters.length,
  });

  // Phase D: build operation-scoped dynamic context (log only + for downstream prompts via buildStoryContext)
  if (isDynamicContextV2Enabled()) {
    try {
      const dyn = buildDynamicContext(
        buildContextRequestFromPlan({
          intent: workingPlan.storyIntent || workingPlan.intent,
          operation: workingPlan.operation,
          userMessage: request.userMessage,
          memory: getMemoryV2(workingMemory),
          recentMessages: request.recentMessages,
          conversationFlow: flow,
          entities: workingPlan.intentRoute?.entities || {
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
      request: workingRequest,
      plan: workingPlan,
      flow,
      started,
    });
    if (toolTurn) {
      return toolTurn;
    }
  }

  // ---- Phase B: clarification without creative/provider failure ----
  if (workingPlan.needsClarification && workingPlan.question && !workingPlan.offerResolution) {
    flow = mergeConversationFlow(flow, {
      lastIntent: workingPlan.intent,
    });
    const style = readStyleProfile({
      emojiStyle: workingMemory.userPreferences.emojiStyle,
    });
    return {
      resultType: "conversation",
      operation: "conversational_chat",
      assistantReply: maybeDecorateChatReply(workingPlan.question, style.emojiStyle),
      suggestions: [
        { label: "Write a scene", prompt: "Write a short opening scene." },
        { label: "Brainstorm ideas", prompt: "Suggest three unique story ideas." },
      ],
      memory: workingMemory,
      storyId: request.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
      plan: workingPlan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: flow,
    };
  }

  // ---- Phase A: clear generation block ----
  if (workingPlan.clearGenerationBlock) {
    flow = mergeConversationFlow(flow, {
      generationBlocked: false,
      phase: "ready_to_write",
      lastIntent: workingPlan.intent,
      lastOffers: [],
      lastOfferType: "none",
      awaiting: { type: "none", topic: "none" },
    });
    const style = readStyleProfile({
      emojiStyle: workingMemory.userPreferences.emojiStyle,
    });
    const memory = {
      ...workingMemory,
      userPreferences: {
        ...workingMemory.userPreferences,
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
      plan: workingPlan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: flow,
    };
  }

  // ---- Phase A: blocked creative attempt ----
  if (
    workingPlan.matchedSignals.includes("generation_blocked") &&
    workingPlan.deterministicHandled
  ) {
    flow = mergeConversationFlow(flow, {
      generationBlocked: true,
      lastIntent: workingPlan.intent,
    });
    const style = readStyleProfile({
      emojiStyle: workingMemory.userPreferences.emojiStyle,
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
        ...workingMemory,
        userPreferences: {
          ...workingMemory.userPreferences,
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
      plan: workingPlan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: flow,
    };
  }

  // ---- Phase A: offer / awaiting resolution ----
  if (workingPlan.offerResolution) {
    const turn = runOfferResolutionTurn({
      resolution: workingPlan.offerResolution,
      memory: workingMemory,
      flow,
      storyId: request.storyId,
    });
    return {
      ...turn,
      plan: workingPlan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: turn.conversationFlow,
    };
  }

  if (workingPlan.awaitingResolution) {
    const turn = runAwaitingResolutionTurn({
      resolution: workingPlan.awaitingResolution,
      memory: workingMemory,
      flow,
      storyId: request.storyId,
    });
    return {
      ...turn,
      plan: workingPlan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: turn.conversationFlow,
    };
  }

  // ---- Phase A: collaborative brainstorm ----
  if (workingPlan.collaborationMode && workingPlan.operation === "brainstorm") {
    const turn = await runCollaborativeBrainstormTurn({
      userId: request.userId,
      conversationId: request.conversationId,
      storyId: request.storyId,
      memory: workingMemory,
      userMessage: request.userMessage,
      recentMessages: request.recentMessages,
      turnRequestId: request.turnRequestId,
      flow,
      openConcept: workingPlan.openConcept ?? {
        matched: true,
        kind: "help_create",
        genreHints: [],
        topicLabel: request.userMessage.slice(0, 80),
        preferOfferType: "openings",
      },
    });
    return {
      ...turn,
      plan: workingPlan,
      brainVersion: BRAIN_VERSION,
      conversationFlow: turn.conversationFlow,
    };
  }

  // ---- Existing executor (deterministic prefs/memory, creative, chat) ----
  let turn = await runStoryOperation({
    userId: request.userId,
    conversationId: request.conversationId,
    storyId: request.storyId,
    memory: workingMemory,
    userMessage: request.userMessage,
    recentMessages: request.recentMessages,
    turnRequestId: request.turnRequestId,
    intent: workingPlan.storyIntent || workingPlan.intent,
  });

  // A deterministic correction is valuable only if it changes what the story
  // writes next. For an established project, keep the patched memory and run
  // the existing continuation path instead of returning its "Got it" receipt.
  // This deliberately stays after the deterministic executor so removals and
  // corrections are persisted before the creative context is built.
  if (
    request.storyId &&
    turn.operation === "memory_update" &&
    turn.actionOk &&
    !flow.generationBlocked &&
    !turn.memory.userPreferences.doNotStartYet
  ) {
    turn = await runStoryOperation({
      userId: request.userId,
      conversationId: request.conversationId,
      storyId: request.storyId,
      memory: turn.memory,
      userMessage:
        "Continue the story using the just-updated context. Rewrite the affected passage if needed, then move the story forward with live action and dialogue.",
      recentMessages: request.recentMessages,
      turnRequestId: request.turnRequestId,
      intent: "continue_story",
    });
  }

  // Sync flow flags from plan / memory prefs
  const blocked =
    workingPlan.setGenerationBlock === true ||
    Boolean(turn.memory.userPreferences.doNotStartYet) ||
    flow.generationBlocked;

  flow = mergeConversationFlow(flow, {
    generationBlocked: workingPlan.clearGenerationBlock ? false : blocked,
    lastIntent: workingPlan.intent,
    phase:
      workingPlan.intent === "do_not_start"
        ? "exploring"
        : workingPlan.intent === "greeting"
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
    intent: workingPlan.intent,
    operation: turn.operation,
    resultType: turn.resultType,
    durationMs: Date.now() - started,
    brainVersion: BRAIN_VERSION,
    provider: turn.provider,
    model: turn.model,
  });

  return {
    ...turn,
    plan: workingPlan,
    brainVersion: BRAIN_VERSION,
    conversationFlow: flow,
  };
}

export { memoryStatusForOperation } from "@/lib/ai/services/run-story-operation";
