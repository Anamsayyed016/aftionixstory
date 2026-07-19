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
import { isAIError } from "@/lib/ai/errors";
import { getAIProvider } from "@/lib/ai/registry";
import {
  mergeDecisionIntoMemory,
  parseStoryAgentTurnResult,
} from "@/lib/ai/services/story-agent";
import { generateWriteScene } from "@/lib/ai/services/write-scene";
import { getAiEnv, resolveAgentModel } from "@/lib/env";
import { routeStoryAgentAction } from "@/lib/story-agent/action-router";
import { routeIntent } from "@/lib/story-agent/intent-router";
import {
  buildConceptBrainstormReply,
  extractStoryConcept,
  looksLikeOnboardingGreeting,
  responseMentionsTopic,
} from "@/lib/story-agent/concept-reply";
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
} from "@/lib/story-agent/errors";
import { describeMemoryStatus } from "@/lib/story-agent/memory-patch";
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

async function runStructuredAgent(params: {
  operation: StoryOperation;
  memory: StoryMemory;
  userMessage: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{
  decision: StoryAgentTurnResult;
  provider: string;
  model: string;
  durationMs: number;
}> {
  const profile = OPERATION_PROFILES[params.operation];
  const env = getAiEnv();
  const model = resolveAgentModel(env);
  const provider = getAIProvider();
  const ctx = buildStoryContext({
    operation: params.operation,
    memory: params.memory,
    userMessage: params.userMessage,
    recentMessages: params.recentMessages,
  });

  let system: string;
  let prompt: string;
  if (params.operation === "brainstorm" || params.operation === "suggest_options") {
    ({ system, prompt } = buildBrainstormPrompt(ctx));
  } else if (params.operation === "memory_update") {
    ({ system, prompt } = buildMemoryUpdatePrompt(ctx));
  } else if (params.operation === "conversational_chat") {
    system = buildConversationSystemPrompt();
    prompt = buildConversationUserPrompt(ctx);
  } else {
    ({ system, prompt } = buildStoryAgentDecisionPrompt(ctx));
  }

  const result = await provider.generateText({
    systemInstruction: system,
    prompt,
    temperature: profile.temperature,
    maxOutputTokens: profile.maxOutputTokens,
    model,
    operation: `story_op_${params.operation}`,
    reasoningEffort: "minimal",
    outputMode: "json",
  });

  let decision: StoryAgentTurnResult;
  try {
    decision = parseStoryAgentTurnResult(result.text);
  } catch (error) {
    if (isAIError(error)) {
      throw new Error(
        "I couldn’t understand the assistant’s reply format. Please try again."
      );
    }
    throw error;
  }

  return {
    decision,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
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
}): Promise<NormalizedTurnResult> {
  const started = Date.now();
  let memory = seedMemoryFromMessage(params.memory, params.userMessage);
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
    const style = readStyleProfile({
      emojiStyle: memory.userPreferences.emojiStyle,
    });
    let assistantReply = route.fixedReply;
    if (styleApplied.confirmReply && styleApplied.styleLabel) {
      assistantReply = styleApplied.confirmReply;
    } else {
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
        : [];

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation,
        detectedIntent: route.reason,
        messageLength: params.userMessage.length,
        messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
        languageLabel: route.languageLabel ?? langApplied.languageLabel,
        narrationLanguage: memory.userPreferences.narrationLanguage,
        dialogueLanguage: memory.userPreferences.dialogueLanguage,
        outputMode: "none",
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
      draft: memory.latestDraft?.content
        ? {
            title: memory.latestDraft.title || "Draft",
            content: memory.latestDraft.content,
            wordCount: memory.latestDraft.wordCount || 0,
            draftKind: "scene",
            saved: false,
            clientRequestId: memory.latestDraft.clientRequestId || "",
          }
        : null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
    };
  }

  // ---- Concept / brainstorm without fixed reply: answer the current message ----
  if (
    operation === "brainstorm" ||
    operation === "suggest_options" ||
    route.reason === "concept_create_request"
  ) {
    const concept = buildConceptBrainstormReply(params.userMessage);
    memory = {
      ...memory,
      storyMemory: {
        ...memory.storyMemory,
        concept: memory.storyMemory.concept || concept.memoryConcept,
        genre:
          memory.storyMemory.genre.length > 0
            ? memory.storyMemory.genre
            : extractStoryConcept(params.userMessage).genreHints.slice(0, 2),
      },
      updatedAt: new Date().toISOString(),
    };

    // Prefer LLM when available; fall back to topic-aware reply (never onboarding greeting)
    let assistantReply = concept.assistantReply;
    let suggestions = concept.suggestions;
    let providerResultValid = false;
    let fallbackUsed = true;
    let fallbackReason = "concept_deterministic";
    let providerName: string | undefined;
    let modelName: string | undefined;
    let durationMs = Date.now() - started;

    try {
      const agent = await runStructuredAgent({
        operation: "brainstorm",
        memory,
        userMessage: params.userMessage,
        recentMessages: params.recentMessages,
      });
      const reply = agent.decision.assistantReply?.trim() || "";
      const topic = extractStoryConcept(params.userMessage).topicLabel;
      const relevant =
        reply.length > 0 &&
        !looksLikeOnboardingGreeting(reply) &&
        (responseMentionsTopic(reply, topic) ||
          /obstacle|conflict|direction|build|concept|opening/i.test(reply));

      if (relevant) {
        assistantReply = reply;
        suggestions =
          agent.decision.suggestions?.length > 0
            ? agent.decision.suggestions
            : concept.suggestions;
        memory = mergeDecisionIntoMemory(memory, agent.decision);
        if (!memory.storyMemory.concept) {
          memory = {
            ...memory,
            storyMemory: {
              ...memory.storyMemory,
              concept: concept.memoryConcept,
            },
          };
        }
        providerResultValid = true;
        fallbackUsed = false;
        fallbackReason = "";
        providerName = agent.provider;
        modelName = agent.model;
        durationMs = agent.durationMs;
      } else {
        fallbackReason = looksLikeOnboardingGreeting(reply)
          ? "rejected_onboarding_greeting"
          : "low_relevance_retry";
        // one stricter deterministic path — do not show greeting
        assistantReply = concept.assistantReply;
        suggestions = concept.suggestions;
      }
    } catch {
      fallbackReason = "provider_failed_concept_fallback";
      assistantReply = concept.assistantReply;
      suggestions = concept.suggestions;
    }

    const style = readStyleProfile({
      emojiStyle: memory.userPreferences.emojiStyle,
    });
    if (!fallbackUsed) {
      assistantReply = maybeDecorateChatReply(assistantReply, style.emojiStyle);
    }

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation: "brainstorm",
        detectedIntent: route.reason,
        messageLength: params.userMessage.length,
        messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
        outputMode: providerResultValid ? "structured" : "concept_fallback",
        providerResultValid,
        fallbackUsed,
        fallbackReason: fallbackReason || undefined,
        provider: providerName ?? null,
        model: modelName ?? null,
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
      draft: memory.latestDraft?.content
        ? {
            title: memory.latestDraft.title || "Draft",
            content: memory.latestDraft.content,
            wordCount: memory.latestDraft.wordCount || 0,
            draftKind: "scene",
            saved: false,
            clientRequestId: memory.latestDraft.clientRequestId || "",
          }
        : null,
      showReview: false,
      actionType: "suggest_options",
      actionOk: true,
      requiresConfirmation: false,
      provider: providerName,
      model: modelName,
      outputMode: "structured",
      durationMs,
    };
  }

  // ---- Creative plain-text paths ----
  if (
    operation === "write_scene" ||
    (operation === "revise_draft" && route.skipClassifier)
  ) {
    try {
      const scene = await generateWriteScene({
        userId: params.userId,
        memory,
        userMessage: params.userMessage,
        mode: operation === "revise_draft" ? "revise" : "scene",
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
        },
        updatedAt: new Date().toISOString(),
      };

      const assistantReply =
        operation === "revise_draft"
          ? `Here’s a revised draft (${scene.wordCount} words). It’s unsaved — rewrite, continue, or use it in your story when you’re ready.`
          : `Here’s a scene draft (${scene.wordCount} words). It’s unsaved — you can rewrite, make it more emotional, continue, or save it into a story later.`;

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
          },
        };
        return {
          resultType: "creative_draft",
          operation: "write_scene",
          assistantReply: `Here’s a draft (${scene.wordCount} words). Unsaved — rewrite or continue anytime.`,
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
    });
  } catch (error) {
    const style = readStyleProfile({
      emojiStyle: memory.userPreferences.emojiStyle,
    });
    // NEVER use onboarding greeting for a real user message
    const conceptFallback = buildConceptBrainstormReply(params.userMessage);
    const isGreetingOnly = /^(hey|hi|hello|hola|help|namaste)[.!?]*$/i.test(
      params.userMessage.trim()
    );
    const fallback = isGreetingOnly
      ? maybeDecorateChatReply(
          "Hey! 😊 Apna rough story idea batao—ek character, scene, ya sirf ek feeling bhi chalegi.",
          style.emojiStyle
        )
      : conceptFallback.assistantReply;

    console.info(
      JSON.stringify({
        event: "story_operation.turn",
        operation: structuredOp,
        detectedIntent: route.reason,
        messageLength: params.userMessage.length,
        messageFingerprint: extractStoryConcept(params.userMessage).fingerprint,
        outputMode: "fallback",
        providerResultValid: false,
        fallbackUsed: true,
        fallbackReason: isGreetingOnly
          ? "greeting_provider_failed"
          : "chat_provider_failed_concept_fallback",
        code: isStoryAgentError(error)
          ? error.code
          : "AGENT_RESPONSE_INVALID",
        durationMs: Date.now() - started,
        conversationId: params.conversationId,
        turnRequestId: params.turnRequestId,
      })
    );
    return {
      resultType: "conversation",
      operation: structuredOp,
      assistantReply: fallback,
      suggestions: isGreetingOnly
        ? [
            {
              label: "Suggest 3 concepts",
              prompt: "Suggest three unique story concepts for me.",
            },
          ]
        : conceptFallback.suggestions,
      memory: isGreetingOnly
        ? memory
        : {
            ...memory,
            storyMemory: {
              ...memory.storyMemory,
              concept: memory.storyMemory.concept || conceptFallback.memoryConcept,
            },
          },
      storyId: params.storyId,
      draft: memory.latestDraft?.content
        ? {
            title: memory.latestDraft.title || "Draft",
            content: memory.latestDraft.content,
            wordCount: memory.latestDraft.wordCount || 0,
            draftKind: "scene",
            saved: false,
            clientRequestId: memory.latestDraft.clientRequestId || "",
          }
        : null,
      showReview: false,
      actionType: "none",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
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
  let decoratedReply = maybeDecorateChatReply(
    agent.decision.assistantReply,
    style.emojiStyle
  );

  // Relevance guard: never show onboarding greeting after a real message
  let structuredSuggestions =
    agent.decision.suggestions?.length > 0 ? agent.decision.suggestions : [];
  let structuredFallbackUsed = false;
  if (looksLikeOnboardingGreeting(decoratedReply)) {
    const concept = buildConceptBrainstormReply(params.userMessage);
    decoratedReply = concept.assistantReply;
    structuredSuggestions = concept.suggestions;
    structuredFallbackUsed = true;
    memory = {
      ...memory,
      storyMemory: {
        ...memory.storyMemory,
        concept: memory.storyMemory.concept || concept.memoryConcept,
      },
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
      providerResultValid: !structuredFallbackUsed,
      fallbackUsed: structuredFallbackUsed,
      fallbackReason: structuredFallbackUsed
        ? "rejected_onboarding_greeting"
        : undefined,
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
    draft: memory.latestDraft?.content
      ? {
          title: memory.latestDraft.title || "Draft",
          content: memory.latestDraft.content,
          wordCount: memory.latestDraft.wordCount || 0,
          draftKind: "scene",
          saved: false,
          clientRequestId: memory.latestDraft.clientRequestId || "",
        }
      : null,
    showReview: Boolean(routed.result.showReview),
    actionType: routed.result.type,
    actionOk: routed.result.ok,
    requiresConfirmation: agent.decision.requiresConfirmation,
    provider: agent.provider,
    model: agent.model,
    outputMode: "structured",
    durationMs: agent.durationMs,
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
