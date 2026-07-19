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
  detectLanguageInstruction,
  languagePrefsToStoryLanguageLabel,
  readLanguagePreferences,
} from "@/lib/story-agent/language-preferences";
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
        languageLabel: route.languageLabel ?? langApplied.languageLabel,
        narrationLanguage: memory.userPreferences.narrationLanguage,
        dialogueLanguage: memory.userPreferences.dialogueLanguage,
        outputMode: "none",
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
      assistantReply: route.fixedReply,
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
      const message =
        error instanceof Error
          ? error.message
          : "I couldn’t generate that scene correctly. Please retry.";
      console.info(
        JSON.stringify({
          event: "story_operation.turn",
          operation,
          detectedIntent: route.reason,
          outputMode: "text",
          validation: "failed",
          durationMs: Date.now() - started,
          conversationId: params.conversationId,
          turnRequestId: params.turnRequestId,
        })
      );
      return {
        resultType: "error",
        operation,
        assistantReply: message.includes("scene")
          ? message
          : "I couldn’t generate that scene correctly. Please retry.",
        suggestions: [],
        memory,
        storyId: params.storyId,
        draft: null,
        showReview: false,
        actionType: operation,
        actionOk: false,
        requiresConfirmation: false,
        durationMs: Date.now() - started,
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

  // ---- Structured conversational / memory / brainstorm ----
  const structuredOp: StoryOperation =
    operation === "brainstorm" ||
    operation === "memory_update" ||
    operation === "suggest_options" ||
    operation === "inspect_memory"
      ? operation
      : "conversational_chat";

  const agent = await runStructuredAgent({
    operation: structuredOp,
    memory,
    userMessage: params.userMessage,
    recentMessages: params.recentMessages,
  });

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

  const routed = await routeStoryAgentAction({
    userId: params.userId,
    conversationId: params.conversationId,
    storyId: params.storyId,
    memory,
    decision: {
      ...agent.decision,
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
      outputMode: "structured",
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
    assistantReply: agent.decision.assistantReply,
    suggestions:
      routed.result.suggestions ?? agent.decision.suggestions ?? [],
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
