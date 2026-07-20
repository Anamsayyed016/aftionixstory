/**
 * Conversation Brain adapter for Story Tool Framework (Phase G).
 */

import "server-only";

import { logAiEvent } from "@/lib/ai/logger";
import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import { mergeConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type {
  ConversationTurnRequest,
  ConversationTurnResult,
  TurnPlan,
} from "@/lib/conversation-brain/types";
import { BRAIN_VERSION } from "@/lib/conversation-brain/types";
import type { DynamicContext } from "@/lib/context-builder/v2/schema";
import { generateTextCompat } from "@/lib/provider-router/v2/legacy-generate";
import { buildPrompt } from "@/lib/prompt-registry/build";
import { isPromptRegistryV2Enabled } from "@/lib/prompt-registry/feature-flag";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { maybeDecorateChatReply, readStyleProfile } from "@/lib/story-agent/style-profile";
import { toLegacyStoryMemory } from "@/lib/story-memory/v2";
import { ConversationStateMemoryRepository } from "@/lib/story-memory/v2/repository";
import { executeToolRequests } from "@/lib/tools/executor";
import { isStoryToolFrameworkEnabled } from "@/lib/tools/feature-flag";
import { planStoryTools } from "@/lib/tools/planner";
import type { ToolRequest } from "@/lib/tools/schemas";
import { safeParseToolRequestsFromText } from "@/lib/tools/tool-request";
import type { ToolBatchResult } from "@/lib/tools/types";

function wrapMemory(
  v2: ReturnType<ConversationStateMemoryRepository["getMemory"]>
): StoryMemory {
  const legacy = toLegacyStoryMemory(v2);
  return Object.assign(legacy, {
    memoryVersion: 2,
    __memoryV2: v2,
  }) as StoryMemory;
}

function formatToolReply(
  batch: ToolBatchResult,
  assistantReply?: string
): string {
  if (assistantReply?.trim()) return assistantReply.trim();
  if (batch.summary.trim()) return batch.summary.trim();
  return "Done — I updated the story memory.";
}

function slimContext(memory: StoryMemory): DynamicContext {
  const v2 = getMemoryV2(memory);
  return {
    contextVersion: 2,
    operation: "memory_update",
    story: {
      title: v2.story.title,
      concept: v2.story.concept,
      genre: v2.story.genre,
      tone: v2.story.tone,
      themes: v2.story.themes || [],
      setting: v2.story.setting,
    },
    characters: v2.characters.slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      aliases: c.aliases,
      status: c.status,
      personalityTraits: c.personalityTraits,
      goals: c.goals,
      fears: c.fears,
      strengths: c.strengths,
      weaknesses: c.weaknesses,
      notes: c.notes,
      avoid: c.avoid,
    })),
    relationships: v2.relationships.slice(0, 8) as never,
    locations: [],
    objects: [],
    events: [],
    timeline: [],
    openThreads: [],
    secrets: [],
    promises: [],
    worldRules: [],
    writingRules: [],
    preferences: v2.userPreferences as never,
    continuity: v2.continuity as never,
    recentConversation: [],
    latestDraft: null,
    recentSummary: null,
    knowledge: { authorKnowledge: [], characterKnowledge: {} },
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

async function planToolRequestsViaAi(params: {
  request: ConversationTurnRequest;
  plan: TurnPlan;
}): Promise<{ requests: ToolRequest[]; assistantReply?: string } | null> {
  let system = `You are StoryVerse's Tool Planner. Providers never mutate memory.
Emit JSON only with shape:
{"toolRequests":[{"toolId":"...","arguments":{},"reason":"...","confidence":0.9}],"assistantReply":"short natural ack"}
Use only registered toolIds. Prefer character.rename, character.update, relationship.create, preferences.*, timeline.*, search.*, validation.*.
Do not write story prose. Do not emit memoryPatch.`;
  let user = params.request.userMessage;

  if (isPromptRegistryV2Enabled()) {
    try {
      const built = buildPrompt({
        promptId: "tool.plan",
        userMessage: params.request.userMessage,
        intent: String(params.plan.storyIntent || params.plan.intent),
        operation: "memory_update",
        context: slimContext(params.request.memory),
      });
      system =
        built.messages.find((m) => m.role === "system")?.content || system;
      user = built.messages.find((m) => m.role === "user")?.content || user;
    } catch {
      // fall back to inline system prompt
    }
  }

  try {
    const result = await generateTextCompat({
      modelKind: "agent",
      turnRequestId: params.request.turnRequestId,
      input: {
        systemInstruction: system,
        prompt: user,
        temperature: 0.2,
        maxOutputTokens: 1200,
        operation: "tool_plan",
        outputMode: "json",
        reasoningEffort: "minimal",
      },
    });
    const parsed = safeParseToolRequestsFromText(result.text);
    if (!parsed.ok || parsed.requests.length === 0) return null;
    return {
      requests: parsed.requests,
      assistantReply: parsed.assistantReply,
    };
  } catch {
    return null;
  }
}

export type ToolFrameworkTurnOptions = {
  /** Inject requests (tests) — skips AI planner */
  precomputedRequests?: ToolRequest[];
  skipAiPlanner?: boolean;
};

/**
 * Attempt a tool-framework turn. Returns null when tools are not applicable
 * or planning/execution failed (caller should fall through to Phase A–F path).
 */
export async function runToolFrameworkTurn(params: {
  request: ConversationTurnRequest;
  plan: TurnPlan;
  flow: ConversationFlow;
  started: number;
  options?: ToolFrameworkTurnOptions;
}): Promise<ConversationTurnResult | null> {
  if (!isStoryToolFrameworkEnabled()) return null;

  const intent = String(params.plan.storyIntent || params.plan.intent);
  const toolPlan = planStoryTools({
    intent,
    userMessage: params.request.userMessage,
    memory: params.request.memory,
    entities: params.plan.intentRoute?.entities,
  });

  if (!toolPlan.requiresTools) return null;

  let requests = params.options?.precomputedRequests?.length
    ? params.options.precomputedRequests
    : toolPlan.requests;
  let assistantReply: string | undefined;

  if (
    requests.length === 0 &&
    toolPlan.needsAiPlanner &&
    !params.options?.skipAiPlanner
  ) {
    const aiPlan = await planToolRequestsViaAi({
      request: params.request,
      plan: params.plan,
    });
    if (!aiPlan) return null;
    requests = aiPlan.requests;
    assistantReply = aiPlan.assistantReply;
  }

  if (requests.length === 0) return null;

  const repository = new ConversationStateMemoryRepository(
    getMemoryV2(params.request.memory)
  );

  const batch = await executeToolRequests(requests, {
    repository,
    conversationId: params.request.conversationId,
    expectedConversationId: params.request.conversationId,
  });

  if (!batch.success) {
    logAiEvent("warn", "conversation_brain.tools", {
      requestId: params.request.turnRequestId,
      conversationId: params.request.conversationId,
      success: false,
      toolCount: requests.length,
      rolledBack: batch.executionMetadata.rolledBack,
      warningCount: batch.warnings.length,
    });
    return null;
  }

  const memory = wrapMemory(repository.getMemory());
  const style = readStyleProfile({
    emojiStyle: memory.userPreferences.emojiStyle,
  });
  const flow = mergeConversationFlow(params.flow, {
    lastIntent: params.plan.intent,
  });

  logAiEvent("info", "conversation_brain.tools", {
    requestId: params.request.turnRequestId,
    conversationId: params.request.conversationId,
    success: true,
    toolCount: batch.executionMetadata.toolCount,
    entityCount: batch.executionMetadata.entityCount,
    durationMs: batch.executionMetadata.durationMs,
    warningCount: batch.warnings.length,
  });

  return {
    resultType: "conversation",
    operation: "memory_update",
    assistantReply: maybeDecorateChatReply(
      formatToolReply(batch, assistantReply),
      style.emojiStyle
    ),
    suggestions: [
      { label: "Write a scene", prompt: "Write a short opening scene." },
      { label: "Continue", prompt: "Continue from here." },
    ],
    memory,
    storyId: params.request.storyId,
    draft: null,
    showReview: false,
    actionType: "none",
    actionOk: true,
    requiresConfirmation: false,
    outputMode: "structured",
    durationMs: Date.now() - params.started,
    retryCount: 0,
    plan: params.plan,
    brainVersion: BRAIN_VERSION,
    conversationFlow: flow,
  };
}
