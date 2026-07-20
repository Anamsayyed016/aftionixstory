import "server-only";

import {
  buildStoryContext,
  seedMemoryFromMessage,
} from "@/lib/ai/context/story-context-builder";
import { buildBrainstormPrompt } from "@/lib/ai/prompts/brainstorm-prompt";
import {
  buildConversationSystemPrompt,
  buildConversationUserPrompt,
} from "@/lib/ai/prompts/conversation-prompt";
import { buildMemoryUpdatePrompt } from "@/lib/ai/prompts/memory-update-prompt";
import { buildStoryAgentDecisionPrompt } from "@/lib/ai/prompts/story-agent-decision-prompt";
import { logAiEvent } from "@/lib/ai/logger";
import {
  composeCreateChatPrompt,
  isPromptRegistryV2Enabled,
  promptResultToLegacyParts,
  resolveTemperature,
  resolveMaxOutputTokens,
  promptLogFieldsForAiEvent,
} from "@/lib/prompt-registry";
import { isAIError } from "@/lib/ai/errors";
import { generateWithFailover } from "@/lib/ai/failover";
import { resolveFailoverProviders } from "@/lib/env";
import {
  mergeDecisionIntoMemory,
  parseAgentDecisionResilient,
} from "@/lib/ai/services/story-agent";
import { generateWriteScene } from "@/lib/ai/services/write-scene";
import { getAiEnv } from "@/lib/env";
import { routeStoryAgentAction } from "@/lib/story-agent/action-router";
import { tryDeterministicTurn } from "@/lib/story-agent/deterministic-router";
import { routeIntent } from "@/lib/story-agent/intent-router";
import {
  extractStoryConcept,
  looksLikeHardcodedConceptTemplate,
  looksLikeOnboardingGreeting,
  BRAINSTORM_FAILURE_USER_MESSAGE,
  MEMORY_FAILURE_USER_MESSAGE,
  PROVIDER_FAILURE_USER_MESSAGE,
  responseFingerprint,
  responseMentionsTopic,
} from "@/lib/story-agent/concept-reply";
import { resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import {
  detectLanguageInstruction,
  languagePrefsToStoryLanguageLabel,
  readLanguagePreferences,
} from "@/lib/story-agent/language-preferences";
import {
  detectStyleFeedback,
  maybeDecorateChatReply,
  mergeStyleProfile,
  readStyleProfile,
} from "@/lib/story-agent/style-profile";
import {
  friendlyMessageForCode,
  isStoryAgentError,
  StoryAgentError,
} from "@/lib/story-agent/errors";
import {
  applyMemoryPatch,
  describeMemoryStatus,
  getMemoryV2,
} from "@/lib/story-agent/memory-patch";
import type { NormalizedTurnResult } from "@/lib/story-agent/operation-result";
import {
  OPERATION_PROFILES,
  type StoryOperation,
} from "@/lib/story-agent/operations";
import {
  storyAgentTurnResultSchema,
  type StoryAgentTurnResult,
  type StoryMemory,
} from "@/lib/story-agent/schema";

function applyStyleFeedbackToMemory(
  memory: StoryMemory,
  userMessage: string
): { memory: StoryMemory; styleLabel?: string; confirmReply?: string } {
  const current = readStyleProfile({
    formality: memory.userPreferences.formality,
    dialogueStyle: memory.userPreferences.dialogueStyle,
    narrationStyle: memory.userPreferences.narrationStyle,
    emojiStyle: memory.userPreferences.emojiStyle,
    uppercaseForLoudDialogue:
      memory.userPreferences.uppercaseForLoudDialogue,
    episodeLength: memory.userPreferences.episodeLength,
    avoidFormalHindi: memory.userPreferences.avoidFormalHindi,
    preferShortDialogues: memory.userPreferences.preferShortDialogues,
    pacingHint: memory.userPreferences.pacingHint,
    avoid: memory.userPreferences.avoid,
  });
  const detected = detectStyleFeedback(userMessage, current);
  if (!detected.matched) return { memory };

  const merged = mergeStyleProfile(current, detected.patch);
  const writingRules = [...memory.writingRules];
  for (const rule of detected.writingRules) {
    if (!writingRules.some((r) => r.rule === rule)) {
      writingRules.push({ rule, priority: "important" });
    }
  }

  return {
    memory: {
      ...memory,
      writingRules,
      userPreferences: {
        ...memory.userPreferences,
        formality: merged.formality,
        dialogueStyle: merged.dialogueStyle,
        narrationStyle: merged.narrationStyle,
        emojiStyle: merged.emojiStyle,
        uppercaseForLoudDialogue: merged.uppercaseForLoudDialogue,
        episodeLength: merged.episodeLength,
        avoidFormalHindi: merged.avoidFormalHindi,
        preferShortDialogues: merged.preferShortDialogues,
        pacingHint: merged.pacingHint,
        avoid: merged.avoid,
        slowBurn: merged.pacingHint === "slow" ? true : memory.userPreferences.slowBurn,
      },
      updatedAt: new Date().toISOString(),
    },
    styleLabel: detected.label,
    confirmReply: detected.confirmReply,
  };
}

function applyLanguagePrefsToMemory(
  memory: StoryMemory,
  userMessage: string
): { memory: StoryMemory; languageLabel?: string } {
  const existing = readLanguagePreferences({
    narrationLanguage: memory.userPreferences.narrationLanguage,
    dialogueLanguage: memory.userPreferences.dialogueLanguage,
    scriptPreference: memory.userPreferences.scriptPreference,
    mirrorUserLanguage: memory.userPreferences.mirrorUserLanguage,
    storyLanguage: memory.storyMemory.language,
  });
  const detected = detectLanguageInstruction(userMessage, existing);
  if (!detected.matched) {
    return { memory };
  }

  const resolved = detected.resolved;
  return {
    memory: {
      ...memory,
      storyMemory: {
        ...memory.storyMemory,
        language: languagePrefsToStoryLanguageLabel(resolved),
      },
      userPreferences: {
        ...memory.userPreferences,
        narrationLanguage: resolved.narrationLanguage,
        dialogueLanguage: resolved.dialogueLanguage,
        scriptPreference: resolved.scriptPreference,
        mirrorUserLanguage: resolved.mirrorUserLanguage,
      },
      updatedAt: new Date().toISOString(),
    },
    languageLabel: detected.detectedLabel,
  };
}

function emptyPatch(): StoryAgentTurnResult["memoryPatch"] {
  return {
    story: {},
    characters: [],
    relationships: [],
    writingRules: [],
    preferences: {},
    remove: [],
  };
}

function decisionFromParts(
  parts: Partial<StoryAgentTurnResult> & { assistantReply: string }
): StoryAgentTurnResult {
  return storyAgentTurnResultSchema.parse({
    intent: "chat",
    requiresConfirmation: false,
    clarificationQuestion: null,
    memoryPatch: emptyPatch(),
    action: { type: "none", payload: {} },
    suggestions: [],
    ...parts,
  });
}

function creativeSuggestions(): Array<{ label: string; prompt: string }> {
  return [
    { label: "Rewrite", prompt: "Rewrite the previous scene." },
    {
      label: "More emotional",
      prompt: "Make the previous scene slower and more emotional.",
    },
    { label: "Continue", prompt: "Continue from here." },
    {
      label: "Uppercase dialogues",
      prompt: "Revise the previous scene and add UPPERCASE for loud dialogues.",
    },
  ];
}

function buildWriteSceneAck(userMessage: string): string {
  const resolved = resolveSceneRequest(userMessage);
  const names = resolved.characterNames;
  const pair =
    names.length >= 2
      ? `${names[0]} aur ${names[1]}`
      : names[0] || "characters";
  const conflict = resolved.conflictHints[0] || "emotional tension";
  const action = resolved.actionHints[0] || "scene";
  return `Bilkul ❤️ Main ${pair} ki ${action} ko ${conflict} ke around build karti hoon—slow, emotional, aur natural. Scene draft niche ready hai.`;
}

async function runStructuredAgent(params: {
  operation: StoryOperation;
  memory: StoryMemory;
  userMessage: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  turnRequestId?: string;
  intent?: string | null;
  conversationId?: string;
  storyId?: string | null;
}): Promise<{
  decision: StoryAgentTurnResult;
  provider: string;
  model: string;
  durationMs: number;
  failoverUsed: boolean;
  promptId?: string;
  promptVersion?: string;
}> {
  const profile = OPERATION_PROFILES[params.operation];
  const ctx = buildStoryContext({
    operation: params.operation,
    memory: params.memory,
    userMessage: params.userMessage,
    recentMessages: params.recentMessages,
    intent: params.intent || undefined,
    conversationId: params.conversationId,
    storyId: params.storyId,
  });

  let system: string;
  let prompt: string;
  let temperature = profile.temperature;
  let maxOutputTokens = profile.maxOutputTokens;
  let promptId: string | undefined;
  let promptVersion: string | undefined;
  let outputMode: "text" | "json" =
    params.operation === "conversational_chat" ? "text" : "json";

  if (isPromptRegistryV2Enabled()) {
    const built = composeCreateChatPrompt({
      intent: params.intent || params.operation,
      operation: params.operation,
      userMessage: params.userMessage,
      memory: getMemoryV2(params.memory),
      recentMessages: params.recentMessages,
      conversationId: params.conversationId,
      storyId: params.storyId,
      metadata: { turnRequestId: params.turnRequestId },
    });
    const parts = promptResultToLegacyParts(built);
    system = parts.system;
    prompt = parts.prompt;
    promptId = built.promptId;
    promptVersion = built.promptVersion;
    temperature = resolveTemperature(built.providerHints.temperatureProfile);
    maxOutputTokens = resolveMaxOutputTokens(
      built.providerHints.maxOutputTokensProfile
    );
    outputMode = built.outputMode;
    logAiEvent("info", "prompt_registry.build", {
      ...promptLogFieldsForAiEvent(built),
      turnRequestId: params.turnRequestId,
      conversationId: params.conversationId,
    });
  } else if (
    params.operation === "brainstorm" ||
    params.operation === "suggest_options"
  ) {
    ({ system, prompt } = buildBrainstormPrompt(ctx));
  } else if (params.operation === "memory_update") {
    ({ system, prompt } = buildMemoryUpdatePrompt(ctx));
  } else if (params.operation === "conversational_chat") {
    system = buildConversationSystemPrompt();
    prompt = buildConversationUserPrompt(ctx);
  } else {
    ({ system, prompt } = buildStoryAgentDecisionPrompt(ctx));
  }

  const isConversation = outputMode === "text";
  const result = await generateWithFailover({
    modelKind: "agent",
    turnRequestId: params.turnRequestId,
    input: {
      systemInstruction: system,
      prompt,
      temperature,
      maxOutputTokens,
      operation: `story_op_${params.operation}`,
      reasoningEffort: "minimal",
      outputMode: isConversation ? "text" : "json",
    },
  });

  let decision: StoryAgentTurnResult;
  try {
    if (isConversation) {
      const text = result.text.trim();
      if (!text) {
        throw new StoryAgentError(
          "CREATIVE_RESPONSE_EMPTY",
          PROVIDER_FAILURE_USER_MESSAGE,
          { retryable: true, operation: params.operation }
        );
      }
      decision = decisionFromParts({
        assistantReply: text,
        intent: "chat",
      });
    } else {
      decision = parseAgentDecisionResilient(result.text, {
        preferIntent:
          params.operation === "brainstorm" ||
          params.operation === "suggest_options"
            ? "brainstorm"
            : "chat",
      });
    }
  } catch (error) {
    // Preserve AIError / StoryAgentError codes for truthful fallbacks upstream
    throw error;
  }

  return {
    decision,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    failoverUsed: result.failoverUsed,
    promptId,
    promptVersion,
  };
}

/**
 * Operation-aware turn runner: intent → context → prompt → model → validate → result.
 */
export async function runStoryOperation(params: {
  userId: string;
  conversationId: string;
  storyId: string | null;
  memory: StoryMemory;
  userMessage: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  turnRequestId: string;
  /** Phase B/E canonical intent when available from Conversation Brain */
  intent?: string | null;
}): Promise<NormalizedTurnResult> {
  const started = Date.now();
  let memory = seedMemoryFromMessage(params.memory, params.userMessage);
  const failover = resolveFailoverProviders(getAiEnv());

  // ---- Deterministic fast path (no AI providers) ----
  const deterministic = tryDeterministicTurn(params.userMessage, memory);
  if (deterministic.handled) {
    if (deterministic.memoryPatch) {
      try {
        memory = applyMemoryPatch(memory, deterministic.memoryPatch);
      } catch {
        throw new StoryAgentError(
          "MEMORY_UPDATE_FAILED",
          MEMORY_FAILURE_USER_MESSAGE,
          { retryable: true, operation: "memory_update" }
        );
      }
    }
    if (deterministic.generationBlocked) {
      memory = {
        ...memory,
        userPreferences: {
          ...memory.userPreferences,
          doNotStartYet: true,
        },
        updatedAt: new Date().toISOString(),
      };
    }

    const style = readStyleProfile({
      emojiStyle: memory.userPreferences.emojiStyle,
    });
    const assistantReply =
      deterministic.intent === "greeting" ||
      deterministic.intent === "update_preference" ||
      deterministic.intent === "update_memory" ||
      deterministic.intent === "correct_memory"
        ? deterministic.assistantReply
        : maybeDecorateChatReply(deterministic.assistantReply, style.emojiStyle);

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation: deterministic.operation,
        detectedIntent: deterministic.intent,
        intentConfidence: deterministic.confidence,
        matchedSignals: deterministic.matchedSignals,
        deterministicHandled: true,
        AIRequired: false,
        primaryProvider: failover.primary,
        fallbackProvider: failover.fallback,
        selectedModel: null,
        providerAttempt: 0,
        providerCallMade: false,
        outputMode: "none",
        validationStage: "deterministic",
        durationMs: Date.now() - started,
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
        persistenceStatus: "pending",
      })
    );

    return {
      resultType: "conversation",
      operation: deterministic.operation,
      assistantReply,
      suggestions:
        deterministic.operation === "memory_update"
          ? [
              {
                label: "Suggest options",
                prompt: "Suggest a few story options based on what we have.",
              },
              {
                label: "Write a scene",
                prompt: "Write a short scene with these characters.",
              },
            ]
          : deterministic.intent === "greeting"
            ? [
                {
                  label: "Suggest 3 concepts",
                  prompt: "Suggest three unique story concepts for me.",
                },
              ]
            : [],
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
    };
  }

  const langApplied = applyLanguagePrefsToMemory(memory, params.userMessage);
  memory = langApplied.memory;
  const styleApplied = applyStyleFeedbackToMemory(memory, params.userMessage);
  memory = styleApplied.memory;
  const route = routeIntent(params.userMessage, memory);
  const operation = route.operation;

  if (route.generationBlocked) {
    memory = {
      ...memory,
      userPreferences: {
        ...memory.userPreferences,
        doNotStartYet: true,
      },
      updatedAt: new Date().toISOString(),
    };
  }
  if (route.clearGenerationBlock) {
    memory = {
      ...memory,
      userPreferences: {
        ...memory.userPreferences,
        doNotStartYet: false,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  // ---- Fixed reply path (no model) ----
  if (route.fixedReply && route.skipClassifier) {
    if (route.memoryPatch) {
      memory = applyMemoryPatch(memory, route.memoryPatch);
    }
    const style = readStyleProfile({
      emojiStyle: memory.userPreferences.emojiStyle,
    });
    let assistantReply = route.fixedReply;
    if (
      styleApplied.confirmReply &&
      styleApplied.styleLabel &&
      route.reason === "style_preference_only"
    ) {
      assistantReply = styleApplied.confirmReply;
    } else if (route.reason !== "memory_facts") {
      assistantReply = maybeDecorateChatReply(assistantReply, style.emojiStyle);
    }
    const suggestions =
      operation === "brainstorm"
        ? [
            {
              label: "Suggest 3 concepts",
              prompt: "Suggest three unique story concepts for me.",
            },
            {
              label: "I have a character",
              prompt: "I have a character idea to start with.",
            },
          ]
        : operation === "memory_update"
          ? [
              {
                label: "Suggest options",
                prompt: "Suggest a few story options based on what we have.",
              },
              {
                label: "Write a scene",
                prompt: "Write a short scene with these characters.",
              },
            ]
          : [];

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation,
        detectedIntent: route.reason,
        intentConfidence: route.confidence,
        matchedSignals: route.matchedSignals ?? [],
        messageLength: params.userMessage.length,
        messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
        languageLabel: route.languageLabel ?? langApplied.languageLabel,
        narrationLanguage: memory.userPreferences.narrationLanguage,
        dialogueLanguage: memory.userPreferences.dialogueLanguage,
        outputMode: "none",
        providerCallMade: false,
        providerResultValid: false,
        fallbackUsed: false,
        provider: null,
        model: null,
        durationMs: Date.now() - started,
        retryCount: 0,
        validation: "fixed_reply",
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
      })
    );

    return {
      resultType: "conversation",
      operation,
      assistantReply,
      suggestions,
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
    };
  }

  // ---- Concept / brainstorm: live provider only (no fake story templates) ----
  if (
    operation === "brainstorm" ||
    operation === "suggest_options" ||
    route.reason === "concept_create_request"
  ) {
    const conceptMeta = extractStoryConcept(params.userMessage);
    memory = {
      ...memory,
      storyMemory: {
        ...memory.storyMemory,
        concept: memory.storyMemory.concept || conceptMeta.topicLabel,
        genre:
          memory.storyMemory.genre.length > 0
            ? memory.storyMemory.genre
            : conceptMeta.genreHints.slice(0, 2),
      },
      updatedAt: new Date().toISOString(),
    };

    const isProviderReplyUsable = (reply: string) => {
      const text = reply.trim();
      if (!text || text.length < 24) return false;
      if (looksLikeOnboardingGreeting(text)) return false;
      if (looksLikeHardcodedConceptTemplate(text)) return false;
      // Accept substantive brainstorm replies; topic match is soft signal only
      if (text.length >= 60) return true;
      return (
        responseMentionsTopic(text, conceptMeta.topicLabel) ||
        /opening|situation|option|concept|scene|character|horror|comedy|thriller|romance|fantasy|conflict|kiss|suggest|unique|serial/i.test(
          text
        )
      );
    };

    let providerCallMade = false;
    let providerSuccess = false;
    let fallbackUsed = false;
    let fallbackType: string | undefined;
    let providerName: string | undefined;
    let modelName: string | undefined;
    let durationMs = Date.now() - started;
    let assistantReply = "";
    let suggestions: Array<{ label: string; prompt: string }> = [];
    let normalizedErrorCode: string | undefined;
    let brainstormPromptId: string | undefined;
    let brainstormPromptVersion: string | undefined;

    try {
      providerCallMade = true;
      let agent = await runStructuredAgent({
        operation: "brainstorm",
        memory,
        userMessage: params.userMessage,
        recentMessages: params.recentMessages,
        turnRequestId: params.turnRequestId,
        intent: params.intent || "brainstorm",
        conversationId: params.conversationId,
        storyId: params.storyId,
      });
      let reply = agent.decision.assistantReply?.trim() || "";

      if (!isProviderReplyUsable(reply)) {
        // One repair retry with stricter instruction — still live provider
        agent = await runStructuredAgent({
          operation: "brainstorm",
          memory,
          userMessage: `${params.userMessage}

STRICT: Answer this exact request with 3–5 concrete, distinct story concepts or openings. Include a short hook for each. Do not ask which conflict type if already specified. Do not use generic slow-burn templates. Return valid JSON with assistantReply.`,
          recentMessages: params.recentMessages,
          turnRequestId: params.turnRequestId,
          intent: params.intent || "brainstorm",
          conversationId: params.conversationId,
          storyId: params.storyId,
        });
        reply = agent.decision.assistantReply?.trim() || "";
      }

      if (!isProviderReplyUsable(reply)) {
        throw new StoryAgentError(
          "AGENT_RESPONSE_INVALID",
          BRAINSTORM_FAILURE_USER_MESSAGE,
          { retryable: true, operation: "brainstorm" }
        );
      }

      assistantReply = maybeDecorateChatReply(
        reply,
        readStyleProfile({
          emojiStyle: memory.userPreferences.emojiStyle,
        }).emojiStyle
      );
      suggestions = agent.decision.suggestions ?? [];
      memory = mergeDecisionIntoMemory(memory, agent.decision);
      if (!memory.storyMemory.concept) {
        memory = {
          ...memory,
          storyMemory: {
            ...memory.storyMemory,
            concept: conceptMeta.topicLabel,
          },
        };
      }
      providerSuccess = true;
      providerName = agent.provider;
      modelName = agent.model;
      durationMs = agent.durationMs;
      brainstormPromptId = agent.promptId;
      brainstormPromptVersion = agent.promptVersion;
    } catch (error) {
      fallbackUsed = true;
      normalizedErrorCode = isStoryAgentError(error)
        ? error.code
        : isAIError(error)
          ? error.code
          : "AGENT_RESPONSE_INVALID";
      fallbackType = normalizedErrorCode;
      const message = isStoryAgentError(error)
        ? friendlyMessageForCode(error.code, "brainstorm")
        : isAIError(error)
          ? BRAINSTORM_FAILURE_USER_MESSAGE
          : BRAINSTORM_FAILURE_USER_MESSAGE;

      console.info(
        JSON.stringify({
          event: "story_operation.turn",
          operation: "brainstorm",
          detectedIntent: route.reason,
          messageLength: params.userMessage.length,
          messageFingerprint: conceptMeta.fingerprint,
          providerCallMade,
          providerSuccess: false,
          fallbackUsed: true,
          fallbackType,
          normalizedErrorCode,
          providerResultValid: false,
          durationMs: Date.now() - started,
          conversationId: params.conversationId,
          turnRequestId: params.turnRequestId,
        })
      );

      return {
        resultType: "error",
        operation: "brainstorm",
        assistantReply: message,
        suggestions: [],
        memory,
        storyId: params.storyId,
        draft: null,
        showReview: false,
        actionType: "none",
        actionOk: false,
        requiresConfirmation: false,
        outputMode: "structured",
        durationMs: Date.now() - started,
        errorCode: isStoryAgentError(error)
          ? error.code
          : "AGENT_RESPONSE_INVALID",
        retryable: true,
      };
    }

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation: "brainstorm",
        detectedIntent: route.reason,
        messageLength: params.userMessage.length,
        messageFingerprint: conceptMeta.fingerprint,
        outputMode: "structured",
        providerCallMade,
        providerSuccess,
        providerResultValid: true,
        fallbackUsed,
        fallbackType,
        provider: providerName ?? null,
        model: modelName ?? null,
        responseFingerprint: responseFingerprint(assistantReply),
        durationMs,
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
      })
    );

    return {
      resultType: "conversation",
      operation: "brainstorm",
      assistantReply,
      suggestions,
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "suggest_options",
      actionOk: true,
      requiresConfirmation: false,
      provider: providerName,
      model: modelName,
      outputMode: "structured",
      durationMs,
      promptId: brainstormPromptId,
      promptVersion: brainstormPromptVersion,
    };
  }

  // ---- Creative plain-text paths ----
  if (
    operation === "write_scene" ||
    (operation === "revise_draft" && route.skipClassifier)
  ) {
    try {
      memory = seedMemoryFromMessage(memory, params.userMessage);
      const previousDraft = memory.latestDraft;
      const scene = await generateWriteScene({
        userId: params.userId,
        memory,
        userMessage: params.userMessage,
        mode: operation === "revise_draft" ? "revise" : "scene",
        conversationId: params.conversationId,
        storyId: params.storyId,
        recentMessages: params.recentMessages,
        intent:
          params.intent ||
          (operation === "revise_draft" ? "rewrite" : "write_scene"),
      });

      const clientRequestId = `ep_${params.turnRequestId}`;
      memory = {
        ...memory,
        latestDraft: {
          title: scene.title,
          content: scene.content,
          wordCount: scene.wordCount,
          clientRequestId,
          action: operation === "revise_draft" ? "REGENERATE" : "NEW_EPISODE",
          sourceConversationId: params.conversationId,
        },
        updatedAt: new Date().toISOString(),
      };

      const assistantReply =
        operation === "revise_draft"
          ? `Here’s a revised draft (${scene.wordCount} words). It’s unsaved — rewrite, continue, or use it in your story when you’re ready.`
          : buildWriteSceneAck(params.userMessage);

      const resolved = resolveSceneRequest(params.userMessage, memory);
      console.info(
        JSON.stringify({
          event: "story_operation.turn",
          operation,
          detectedIntent: route.reason,
          languageLabel: route.languageLabel ?? langApplied.languageLabel,
          narrationLanguage: memory.userPreferences.narrationLanguage,
          dialogueLanguage: memory.userPreferences.dialogueLanguage,
          revisionTriggered: operation === "revise_draft",
          outputMode: "text",
          provider: scene.provider,
          model: scene.model,
          durationMs: scene.durationMs,
          responseLength: scene.content.length,
          retryCount: scene.retryCount,
          languageComplianceRetry: scene.languageComplianceRetry ?? false,
          relevanceRetry: scene.relevanceRetry ?? false,
          contextMismatch: scene.contextMismatch ?? false,
          requestedEntityFingerprints: resolved.fingerprints,
          latestDraftSourceConversationId: params.conversationId,
          previousDraftPresent: Boolean(previousDraft?.content),
          validation: "ok",
          conversationId: params.conversationId,
          turnRequestId: params.turnRequestId,
        })
      );

      return {
        resultType: "creative_draft",
        operation,
        assistantReply,
        suggestions: creativeSuggestions(),
        memory,
        storyId: params.storyId,
        draft: {
          title: scene.title,
          content: scene.content,
          wordCount: scene.wordCount,
          draftKind: scene.draftKind,
          saved: false,
          clientRequestId,
        },
        showReview: false,
        actionType: operation,
        actionOk: true,
        requiresConfirmation: false,
        provider: scene.provider,
        model: scene.model,
        outputMode: "text",
        durationMs: scene.durationMs,
        retryCount: scene.retryCount,
        promptId: scene.promptId,
        promptVersion: scene.promptVersion,
      };
    } catch (error) {
      const preservedDraft = memory.latestDraft?.content
        ? {
            title: memory.latestDraft.title || "Draft",
            content: memory.latestDraft.content,
            wordCount: memory.latestDraft.wordCount || 0,
            draftKind: "scene" as const,
            saved: false as const,
            clientRequestId: memory.latestDraft.clientRequestId || "",
          }
        : null;
      const message = isStoryAgentError(error)
        ? friendlyMessageForCode(error.code, operation)
        : error instanceof Error
          ? error.message
          : operation === "revise_draft"
            ? "I couldn’t apply that change, so I kept the earlier draft unchanged."
            : "I couldn’t generate that scene correctly. Your previous draft is safe—please retry.";
      console.info(
        JSON.stringify({
          event: "story_operation.turn",
          operation,
          detectedIntent: route.reason,
          outputMode: "text",
          validation: "failed",
          code: isStoryAgentError(error) ? error.code : "UNKNOWN_AI_ERROR",
          durationMs: Date.now() - started,
          conversationId: params.conversationId,
          turnRequestId: params.turnRequestId,
        })
      );
      return {
        resultType: "error",
        operation,
        assistantReply: message,
        suggestions: [],
        memory, // previous draft untouched
        storyId: params.storyId,
        draft: preservedDraft,
        showReview: false,
        actionType: operation,
        actionOk: false,
        requiresConfirmation: false,
        durationMs: Date.now() - started,
        errorCode: isStoryAgentError(error) ? error.code : "UNKNOWN_AI_ERROR",
        retryable: true,
      };
    }
  }

  // ---- start / continue / generate / revise via action router ----
  if (
    operation === "start_story" ||
    operation === "generate_episode" ||
    operation === "continue_episode" ||
    operation === "revise_draft" ||
    operation === "create_story" ||
    operation === "save_episode" ||
    operation === "show_story_details"
  ) {
    const generationBlocked =
      Boolean(route.generationBlocked) ||
      Boolean(memory.userPreferences.doNotStartYet);

    let decision = decisionFromParts({
      assistantReply:
        operation === "show_story_details"
          ? describeMemoryStatus(memory)
          : operation === "start_story"
            ? "Starting your opening draft…"
            : operation === "continue_episode"
              ? "Continuing from where we left off…"
              : operation === "revise_draft"
                ? "Revising the latest draft…"
                : "On it.",
      intent:
        operation === "start_story"
          ? "start_story"
          : operation === "revise_draft"
            ? "revise_episode"
            : operation === "create_story"
              ? "create_story"
              : operation === "continue_episode" ||
                  operation === "generate_episode"
                ? "generate_episode"
                : "chat",
      action: {
        type:
          operation === "show_story_details"
            ? "show_review"
            : operation === "create_story"
              ? "create_story"
              : operation === "save_episode"
                ? "save_episode"
                : operation === "revise_draft"
                  ? "revise_draft"
                  : "generate_episode",
        payload: { instruction: params.userMessage },
      },
      memoryPatch: {
        ...emptyPatch(),
        preferences: route.clearGenerationBlock
          ? { doNotStartYet: false }
          : route.generationBlocked
            ? { doNotStartYet: true }
            : {},
      },
    });

    // For revise without draft, fall through to write_scene from instruction
    if (operation === "revise_draft" && !memory.latestDraft?.content) {
      try {
        const scene = await generateWriteScene({
          userId: params.userId,
          memory,
          userMessage: params.userMessage,
          mode: "scene",
          conversationId: params.conversationId,
          storyId: params.storyId,
          recentMessages: params.recentMessages,
          intent: params.intent || "write_scene",
        });
        const clientRequestId = `ep_${params.turnRequestId}`;
        memory = {
          ...memory,
          latestDraft: {
            title: scene.title,
            content: scene.content,
            wordCount: scene.wordCount,
            clientRequestId,
            action: "NEW_EPISODE",
            sourceConversationId: params.conversationId,
          },
        };
        return {
          resultType: "creative_draft",
          operation: "write_scene",
          assistantReply: buildWriteSceneAck(params.userMessage),
          suggestions: creativeSuggestions(),
          memory,
          storyId: params.storyId,
          draft: {
            title: scene.title,
            content: scene.content,
            wordCount: scene.wordCount,
            draftKind: "scene",
            saved: false,
            clientRequestId,
          },
          showReview: false,
          actionType: "write_scene",
          actionOk: true,
          requiresConfirmation: false,
          provider: scene.provider,
          model: scene.model,
          outputMode: "text",
          durationMs: scene.durationMs,
          retryCount: scene.retryCount,
        };
      } catch {
        decision = decisionFromParts({
          assistantReply:
            "Mere paas revise karne ke liye pehle koi draft nahi hai. Pehle ek scene likhne ko bolo, phir rewrite karungi.",
          action: { type: "none", payload: {} },
        });
      }
    }

    const routed = await routeStoryAgentAction({
      userId: params.userId,
      conversationId: params.conversationId,
      storyId: params.storyId,
      memory,
      decision,
      userMessage: params.userMessage,
      turnRequestId: params.turnRequestId,
      generationBlocked:
        generationBlocked &&
        (decision.action.type === "generate_episode" ||
          decision.action.type === "revise_draft"),
    });
    memory = routed.memory;

    let assistantReply = decision.assistantReply;
    if (routed.result.clarificationOnly && routed.result.message) {
      assistantReply = routed.result.message;
    } else if (routed.result.ok && routed.result.draft) {
      assistantReply = `Draft ready: ${routed.result.draft.title} (${routed.result.draft.wordCount} words). Unsaved — rewrite, continue, or save when you’re ready.`;
    } else if (!routed.result.ok && routed.result.message) {
      assistantReply = routed.result.message;
    }

    const draft = routed.result.draft
      ? {
          title: routed.result.draft.title,
          content: routed.result.draft.content,
          wordCount: routed.result.draft.wordCount,
          draftKind: "episode" as const,
          saved: false as const,
          clientRequestId: routed.result.draft.clientRequestId,
        }
      : null;

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation,
        detectedIntent: route.reason,
        outputMode: draft ? "text" : "structured",
        actionOk: routed.result.ok,
        durationMs: Date.now() - started,
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
      })
    );

    return {
      resultType: draft ? "creative_draft" : "structured_action",
      operation,
      assistantReply,
      suggestions: routed.result.suggestions ?? (draft ? creativeSuggestions() : []),
      memory,
      storyId: routed.result.storyId ?? params.storyId,
      draft,
      showReview: Boolean(routed.result.showReview),
      actionType: routed.result.type,
      actionOk: routed.result.ok,
      requiresConfirmation: false,
      outputMode: draft ? "text" : "structured",
      durationMs: Date.now() - started,
    };
  }

  // ---- Structured conversational / memory (brainstorm handled above) ----
  const structuredOp: StoryOperation =
    operation === "memory_update" ||
    operation === "inspect_memory"
      ? operation
      : "conversational_chat";

  let agent;
  try {
    agent = await runStructuredAgent({
      operation: structuredOp,
      memory,
      userMessage: params.userMessage,
      recentMessages: params.recentMessages,
      turnRequestId: params.turnRequestId,
      intent: params.intent || structuredOp,
      conversationId: params.conversationId,
      storyId: params.storyId,
    });
  } catch (error) {
    const isGreetingOnly = /^(hey|hi|hello|hola|help|namaste|salam)[.!?]*$/i.test(
      params.userMessage.trim()
    );
    const failureCopy =
      structuredOp === "memory_update"
        ? MEMORY_FAILURE_USER_MESSAGE
        : isStoryAgentError(error)
          ? friendlyMessageForCode(error.code, structuredOp)
          : isAIError(error)
            ? friendlyMessageForCode(
                error.code === "AI_TIMEOUT"
                  ? "PROVIDER_TIMEOUT"
                  : error.code === "AI_RATE_LIMITED"
                    ? "PROVIDER_RATE_LIMITED"
                    : error.code === "AI_QUOTA_EXCEEDED"
                      ? "PROVIDER_QUOTA_EXCEEDED"
                      : "PROVIDER_UNAVAILABLE",
                structuredOp
              )
            : PROVIDER_FAILURE_USER_MESSAGE;
    const fallback = isGreetingOnly
      ? maybeDecorateChatReply(
          "Hey! 😊 Apna rough story idea batao—ek character, scene, ya sirf ek feeling bhi chalegi.",
          readStyleProfile({
            emojiStyle: memory.userPreferences.emojiStyle,
          }).emojiStyle
        )
      : failureCopy;

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation: structuredOp,
        detectedIntent: route.reason,
        deterministicHandled: false,
        AIRequired: true,
        primaryProvider: failover.primary,
        fallbackProvider: failover.fallback,
        messageLength: params.userMessage.length,
        messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
        outputMode: "fallback",
        providerCallMade: true,
        providerSuccess: false,
        providerResultValid: false,
        fallbackUsed: true,
        fallbackType: isGreetingOnly
          ? "greeting_fixed"
          : "provider_failure_error",
        normalizedError: isStoryAgentError(error)
          ? error.code
          : isAIError(error)
            ? error.code
            : "AGENT_RESPONSE_INVALID",
        code: isStoryAgentError(error)
          ? error.code
          : "AGENT_RESPONSE_INVALID",
        durationMs: Date.now() - started,
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
      })
    );
    return {
      resultType: isGreetingOnly ? "conversation" : "error",
      operation: structuredOp,
      assistantReply: fallback,
      suggestions: isGreetingOnly
        ? [
            {
              label: "Suggest 3 concepts",
              prompt: "Suggest three unique story concepts for me.",
            },
          ]
        : [],
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: isGreetingOnly,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      errorCode: isGreetingOnly
        ? undefined
        : isStoryAgentError(error)
          ? error.code
          : "AGENT_RESPONSE_INVALID",
      retryable: !isGreetingOnly,
    };
  }

  // If classifier unexpectedly asks to generate, honor creative path
  if (
    (agent.decision.action.type === "generate_episode" ||
      agent.decision.action.type === "revise_draft") &&
    !memory.userPreferences.doNotStartYet
  ) {
    const creativeOp: StoryOperation =
      agent.decision.action.type === "revise_draft"
        ? "revise_draft"
        : "write_scene";
    // Prefer dedicated scene writer when no story linked
    if (!params.storyId) {
      try {
        const scene = await generateWriteScene({
          userId: params.userId,
          memory: mergeDecisionIntoMemory(memory, agent.decision),
          userMessage: params.userMessage,
          mode: creativeOp === "revise_draft" ? "revise" : "scene",
          conversationId: params.conversationId,
          storyId: params.storyId,
          recentMessages: params.recentMessages,
          intent:
            params.intent ||
            (creativeOp === "revise_draft" ? "rewrite" : "write_scene"),
        });
        memory = mergeDecisionIntoMemory(memory, agent.decision);
        const clientRequestId = `ep_${params.turnRequestId}`;
        memory = {
          ...memory,
          latestDraft: {
            title: scene.title,
            content: scene.content,
            wordCount: scene.wordCount,
            clientRequestId,
            action: creativeOp === "revise_draft" ? "REGENERATE" : "NEW_EPISODE",
            sourceConversationId: params.conversationId,
          },
        };
        return {
          resultType: "creative_draft",
          operation: creativeOp,
          assistantReply: `${agent.decision.assistantReply}\n\nDraft ready (${scene.wordCount} words) — unsaved.`,
          suggestions: creativeSuggestions(),
          memory,
          storyId: params.storyId,
          draft: {
            title: scene.title,
            content: scene.content,
            wordCount: scene.wordCount,
            draftKind: creativeOp === "revise_draft" ? "rewrite" : "scene",
            saved: false,
            clientRequestId,
          },
          showReview: false,
          actionType: creativeOp,
          actionOk: true,
          requiresConfirmation: false,
          provider: scene.provider,
          model: scene.model,
          outputMode: "text",
          durationMs: scene.durationMs,
        };
      } catch {
        // fall through to conversational reply only
      }
    }
  }

  memory = mergeDecisionIntoMemory(memory, agent.decision);

  const style = readStyleProfile({
    emojiStyle: memory.userPreferences.emojiStyle,
  });
  const decoratedReply = maybeDecorateChatReply(
    agent.decision.assistantReply,
    style.emojiStyle
  );

  // Relevance guard: never show onboarding greeting after a real message
  const structuredSuggestions =
    agent.decision.suggestions?.length > 0 ? agent.decision.suggestions : [];

  if (
    looksLikeOnboardingGreeting(decoratedReply) ||
    looksLikeHardcodedConceptTemplate(decoratedReply)
  ) {
    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation: structuredOp,
        detectedIntent: route.reason,
        messageLength: params.userMessage.length,
        messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
        providerCallMade: true,
        providerSuccess: false,
        providerResultValid: false,
        fallbackUsed: true,
        fallbackType: "rejected_fake_or_greeting_reply",
        provider: agent.provider,
        model: agent.model,
        durationMs: agent.durationMs,
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
      })
    );
    return {
      resultType: "error",
      operation: structuredOp,
      assistantReply: PROVIDER_FAILURE_USER_MESSAGE,
      suggestions: [],
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: false,
      requiresConfirmation: false,
      provider: agent.provider,
      model: agent.model,
      outputMode: "structured",
      durationMs: agent.durationMs,
      errorCode: "AGENT_RESPONSE_INVALID",
      retryable: true,
    };
  }

  const routed = await routeStoryAgentAction({
    userId: params.userId,
    conversationId: params.conversationId,
    storyId: params.storyId,
    memory,
    decision: {
      ...agent.decision,
      assistantReply: decoratedReply,
      suggestions: structuredSuggestions,
      // Never let structured chat call generation after we already tried
      action:
        agent.decision.action.type === "generate_episode" ||
        agent.decision.action.type === "revise_draft"
          ? { type: "none", payload: {} }
          : agent.decision.action,
    },
    userMessage: params.userMessage,
    turnRequestId: params.turnRequestId,
    generationBlocked: Boolean(memory.userPreferences.doNotStartYet),
  });
  memory = routed.memory;

  console.info(
    JSON.stringify({
      event: "story_operation.turn",
      operation: structuredOp,
      detectedIntent: route.reason,
      messageLength: params.userMessage.length,
      messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
      outputMode: "structured",
      providerCallMade: true,
      providerSuccess: true,
      providerResultValid: true,
      fallbackUsed: false,
      responseFingerprint: responseFingerprint(decoratedReply),
      provider: agent.provider,
      model: agent.model,
      durationMs: agent.durationMs,
      conversationId: params.conversationId,
      turnRequestId: params.turnRequestId,
    })
  );

  return {
    resultType: "conversation",
    operation: structuredOp,
    assistantReply: decoratedReply,
    suggestions:
      structuredSuggestions.length > 0
        ? structuredSuggestions
        : (routed.result.suggestions ?? []),
    memory,
    storyId: routed.result.storyId ?? params.storyId,
    draft: null,
    showReview: Boolean(routed.result.showReview),
    actionType: routed.result.type,
    actionOk: routed.result.ok,
    requiresConfirmation: agent.decision.requiresConfirmation,
    provider: agent.provider,
    model: agent.model,
    outputMode: "structured",
    durationMs: agent.durationMs,
    promptId: agent.promptId,
    promptVersion: agent.promptVersion,
  };
}

/** Exported for tests / status UI */
export function memoryStatusForOperation(
  memory: StoryMemory,
  operation: StoryOperation,
  hasDraft: boolean
): string {
  if (hasDraft) return "Draft ready";
  if (operation === "brainstorm" || operation === "suggest_options") {
    return "Building your concept";
  }
  if (operation === "memory_update") return "Listening";
  return describeMemoryStatus(memory);
}
