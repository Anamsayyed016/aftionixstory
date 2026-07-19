import "server-only";

import { AIError, isAIError } from "@/lib/ai/errors";
import {
  STORY_AGENT_SYSTEM,
  buildStoryAgentUserPrompt,
} from "@/lib/ai/services/story-agent-prompt";
import type { AIProvider } from "@/lib/ai/types";
import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import { getAiEnv, resolveAgentModel } from "@/lib/env";
import { shouldBlockGeneration } from "@/lib/story-agent/intent";
import {
  applyMemoryPatch,
  emptyStoryMemory,
  parseStoryMemory,
} from "@/lib/story-agent/memory-patch";
import {
  storyAgentTurnResultSchema,
  type StoryAgentTurnResult,
  type StoryMemory,
} from "@/lib/story-agent/schema";

export function parseStoryAgentTurnResult(raw: string): StoryAgentTurnResult {
  const json = extractJsonObject(raw);
  const parsed = storyAgentTurnResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "The story assistant returned an unreadable response. Please try again.",
      true
    );
  }
  return parsed.data;
}

export async function runStoryAgentDecision(params: {
  userMessage: string;
  memory: StoryMemory;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  storyId: string | null;
  provider?: AIProvider;
}): Promise<{
  decision: StoryAgentTurnResult;
  provider: string;
  model: string;
  durationMs: number;
}> {
  const provider =
    params.provider ?? (await import("@/lib/ai/registry")).getAIProvider();
  const env = getAiEnv();
  const model = resolveAgentModel(env);

  const result = await provider.generateText({
    systemInstruction: STORY_AGENT_SYSTEM,
    prompt: buildStoryAgentUserPrompt({
      userMessage: params.userMessage,
      memory: params.memory,
      recentMessages: params.recentMessages,
      storyId: params.storyId,
      hasUnsavedDraft: Boolean(params.memory.latestDraft?.content),
    }),
    temperature: 0.6,
    maxOutputTokens: 2048,
    model,
    operation: "story_agent_turn",
    reasoningEffort: "minimal",
  });

  let decision: StoryAgentTurnResult;
  try {
    decision = parseStoryAgentTurnResult(result.text);
  } catch (error) {
    if (isAIError(error)) throw error;
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "The story assistant returned an unreadable response. Please try again.",
      true
    );
  }

  // Enforce do-not-start preference even if model asks to generate
  const generationBlocked = shouldBlockGeneration({
    intent: decision.intent,
    doNotStartYet: params.memory.userPreferences.doNotStartYet,
    userMessage: params.userMessage,
  });

  if (
    generationBlocked &&
    (decision.action.type === "generate_episode" ||
      decision.action.type === "revise_draft")
  ) {
    decision = {
      ...decision,
      action: { type: "none", payload: {} },
      assistantReply:
        decision.assistantReply ||
        "Understood — I won’t start writing yet. Tell me when you want to begin.",
    };
  }

  return {
    decision,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
  };
}

export function mergeDecisionIntoMemory(
  memory: StoryMemory,
  decision: StoryAgentTurnResult
): StoryMemory {
  return applyMemoryPatch(memory, decision.memoryPatch);
}

export function readMemoryFromConversationState(state: unknown): StoryMemory {
  if (!state || typeof state !== "object") return emptyStoryMemory();
  const record = state as Record<string, unknown>;
  if (record.storyMemory || record.characters || record.userPreferences) {
    return parseStoryMemory(record);
  }
  // Legacy create-state: seed lightly from draftForm/extraction if present
  const draft = (record.draftForm ?? record.extraction) as
    | Record<string, unknown>
    | undefined;
  if (!draft) return emptyStoryMemory();

  return applyMemoryPatch(emptyStoryMemory(), {
    story: {
      title: typeof draft.title === "string" ? draft.title : undefined,
      concept:
        typeof draft.description === "string"
          ? draft.description
          : undefined,
      genre:
        typeof draft.genre === "string" ? [draft.genre] : undefined,
      language: typeof draft.language === "string" ? draft.language : undefined,
      tone: typeof draft.tone === "string" ? [draft.tone] : undefined,
      setting: typeof draft.setting === "string" ? draft.setting : undefined,
      plot:
        typeof draft.initialPlot === "string"
          ? draft.initialPlot
          : typeof draft.plot === "string"
            ? draft.plot
            : undefined,
      pov:
        typeof draft.pointOfView === "string"
          ? draft.pointOfView
          : typeof draft.pov === "string"
            ? draft.pov
            : undefined,
      writingStyle:
        typeof draft.writingStyle === "string"
          ? draft.writingStyle
          : undefined,
      pacing: typeof draft.pacing === "string" ? draft.pacing : undefined,
    },
    characters: Array.isArray(draft.characters)
      ? draft.characters
          .filter(
            (c): c is Record<string, unknown> =>
              typeof c === "object" && c !== null && typeof (c as { name?: unknown }).name === "string"
          )
          .map((c) => ({
            tempId: typeof c.clientId === "string" ? c.clientId : undefined,
            name: String(c.name),
            role: typeof c.role === "string" ? c.role : undefined,
            personality:
              typeof c.personality === "string" ? [c.personality] : [],
            background:
              typeof c.background === "string" ? c.background : undefined,
          }))
      : [],
  });
}
