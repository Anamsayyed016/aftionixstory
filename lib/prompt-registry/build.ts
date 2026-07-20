/**
 * buildPrompt — main Prompt Registry API (Phase E).
 */

import {
  buildDynamicContext,
  buildContextRequestFromPlan,
} from "@/lib/context-builder/v2/builder";
import type { DynamicContext } from "@/lib/context-builder/v2/schema";
import {
  emptyDynamicFallback,
  promptResultToLegacyParts,
} from "@/lib/prompt-registry/compose";
import { isPromptId, type PromptId } from "@/lib/prompt-registry/ids";
import { summarizePromptForLogs } from "@/lib/prompt-registry/log-summary";
import { getPromptDefinition } from "@/lib/prompt-registry/registry";
import {
  resolvePromptId,
  type ResolvePromptIdInput,
} from "@/lib/prompt-registry/resolve";
import type {
  PromptRequest,
  PromptRequestMetadata,
  PromptResult,
} from "@/lib/prompt-registry/types";
import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type { StoryMemoryV2 } from "@/lib/story-memory/v2";

function emptyContext(operation: string): DynamicContext {
  return {
    contextVersion: 2,
    operation,
    story: {
      title: null,
      concept: null,
      genre: [],
      tone: [],
      themes: [],
      setting: null,
    },
    characters: [],
    relationships: [],
    locations: [],
    objects: [],
    events: [],
    timeline: [],
    openThreads: [],
    secrets: [],
    promises: [],
    worldRules: [],
    writingRules: [],
    preferences: {},
    continuity: {},
    recentConversation: [],
    latestDraft: null,
    recentSummary: null,
    knowledge: { authorKnowledge: [], characterKnowledge: {} },
    instructionContract: null,
    retrieval: {
      includedEntityIds: [],
      excludedCounts: {},
      reasons: [],
      estimatedTokens: 0,
      sectionTokens: {},
      truncated: false,
      truncatedDraft: false,
    },
  };
}

export function buildPrompt(request: PromptRequest): PromptResult {
  const def = getPromptDefinition(request.promptId);
  if (!def || !def.enabled) {
    return emptyDynamicFallback(request.operation, request.userMessage);
  }
  try {
    return def.builder(request);
  } catch {
    return emptyDynamicFallback(request.operation, request.userMessage);
  }
}

export function buildPromptById(
  promptId: PromptId | string,
  params: Omit<PromptRequest, "promptId">
): PromptResult {
  const id = isPromptId(promptId) ? promptId : "conversation.normal";
  return buildPrompt({ ...params, promptId: id });
}

export type ComposeCreateChatPromptParams = {
  intent?: string | null;
  operation: string;
  userMessage: string;
  memory: StoryMemoryV2;
  recentMessages?: Array<{ role: string; content: string }>;
  conversationFlow?: ConversationFlow | null;
  collaborationMode?: boolean;
  needsClarification?: boolean;
  generationBlocked?: boolean;
  entities?: {
    characterNames?: string[];
    episodeNumber?: number | null;
    requestedTone?: string | null;
    requestedLanguage?: string | null;
  };
  metadata?: PromptRequestMetadata;
  conversationId?: string;
  storyId?: string | null;
  /** Force a specific prompt id (e.g. internal.intent_classifier) */
  promptIdOverride?: PromptId;
};

/**
 * End-to-end: resolve promptId → build DynamicContext → buildPrompt.
 */
export function composeCreateChatPrompt(
  params: ComposeCreateChatPromptParams
): PromptResult & { resolveInput: ResolvePromptIdInput } {
  const resolveInput: ResolvePromptIdInput = {
    intent: params.intent,
    operation: params.operation,
    conversationFlow: params.conversationFlow,
    collaborationMode: params.collaborationMode,
    needsClarification: params.needsClarification,
    generationBlocked:
      params.generationBlocked ??
      params.conversationFlow?.generationBlocked,
  };

  const promptId =
    params.promptIdOverride || resolvePromptId(resolveInput);

  let context: DynamicContext;
  try {
    context = buildDynamicContext(
      buildContextRequestFromPlan({
        intent: params.intent || params.operation,
        operation: params.operation,
        userMessage: params.userMessage,
        memory: params.memory,
        recentMessages: params.recentMessages || [],
        conversationFlow: params.conversationFlow,
        entities: {
          characterNames: params.entities?.characterNames || [],
          episodeNumber: params.entities?.episodeNumber ?? null,
          requestedTone: params.entities?.requestedTone ?? null,
          requestedLanguage: params.entities?.requestedLanguage ?? null,
        },
        conversationId: params.conversationId,
        storyId: params.storyId,
      })
    );
  } catch {
    context = emptyContext(params.operation);
  }

  const result = buildPrompt({
    promptId,
    intent: params.intent || params.operation,
    operation: params.operation,
    userMessage: params.userMessage,
    context,
    conversationFlow: params.conversationFlow,
    metadata: {
      ...params.metadata,
      conversationId: params.conversationId,
    },
  });

  return { ...result, resolveInput };
}

export { promptResultToLegacyParts, summarizePromptForLogs };
