import "server-only";

import { AIError, isAIError } from "@/lib/ai/errors";
import {
  STORY_AGENT_SYSTEM,
  buildStoryAgentUserPrompt,
} from "@/lib/ai/services/story-agent-prompt";
import type { AIProvider } from "@/lib/ai/types";
import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import { getAiEnv, resolveAgentModel } from "@/lib/env";
import { generateTextCompat } from "@/lib/provider-router/v2/legacy-generate";
import { applyControlToDecision, shouldBlockGeneration } from "@/lib/story-agent/intent";
import {
  applyMemoryPatch,
  emptyStoryMemory,
  parseStoryMemory,
} from "@/lib/story-agent/memory-patch";
import { sanitizeStoryMemoryCanon } from "@/lib/story-agent/sanitize-memory";
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
      "I couldn’t understand the assistant’s reply format. Please try again.",
      true
    );
  }
  return parsed.data;
}

/**
 * Resilient parse for brainstorm / chat agent envelopes.
 * Coerces unknown intents and recovers assistantReply from partial JSON or plain text.
 */
export function parseAgentDecisionResilient(
  raw: string,
  opts?: { preferIntent?: StoryAgentTurnResult["intent"] }
): StoryAgentTurnResult {
  try {
    return parseStoryAgentTurnResult(raw);
  } catch {
    // continue to recovery
  }

  let json: unknown = null;
  try {
    json = extractJsonObject(raw);
  } catch {
    json = null;
  }

  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    const replyCandidate =
      (typeof record.assistantReply === "string" && record.assistantReply) ||
      (typeof record.reply === "string" && record.reply) ||
      (typeof record.message === "string" && record.message) ||
      "";
    const coerced = {
      assistantReply: String(replyCandidate).trim(),
      intent: opts?.preferIntent || "brainstorm",
      requiresConfirmation: false,
      clarificationQuestion: null,
      memoryPatch: {
        story: {},
        characters: [],
        relationships: [],
        writingRules: [],
        preferences: {},
        remove: [],
      },
      action: { type: "suggest_options", payload: {} },
      suggestions: Array.isArray(record.suggestions) ? record.suggestions : [],
    };
    const parsed = storyAgentTurnResultSchema.safeParse(coerced);
    if (parsed.success && parsed.data.assistantReply.length >= 20) {
      return parsed.data;
    }
  }

  const plain = raw.trim();
  if (
    plain.length >= 40 &&
    !plain.startsWith("{") &&
    !looksLikeEmptyJson(plain)
  ) {
    return storyAgentTurnResultSchema.parse({
      assistantReply: plain.slice(0, 8000),
      intent: opts?.preferIntent || "brainstorm",
      action: { type: "suggest_options", payload: {} },
    });
  }

  throw new AIError(
    "AI_INVALID_RESPONSE",
    "I couldn’t understand the assistant’s reply format. Please try again.",
    true
  );
}

function looksLikeEmptyJson(text: string): boolean {
  return text.startsWith("{") && text.length < 40;
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
  agentProfile: "agent";
}> {
  const env = getAiEnv();
  const model = resolveAgentModel(env);

  const result = await generateTextCompat({
    provider: params.provider,
    modelKind: "agent",
    input: {
      systemInstruction: STORY_AGENT_SYSTEM,
      prompt: buildStoryAgentUserPrompt({
        userMessage: params.userMessage,
        memory: params.memory,
        recentMessages: params.recentMessages,
        storyId: params.storyId,
        hasUnsavedDraft: Boolean(params.memory.latestDraft?.content),
      }),
      temperature: 0.7,
      maxOutputTokens: 1600,
      model,
      operation: "story_agent_turn",
      reasoningEffort: "minimal",
      outputMode: "json",
    },
  });

  let decision: StoryAgentTurnResult;
  try {
    decision = parseStoryAgentTurnResult(result.text);
  } catch (error) {
    if (isAIError(error)) throw error;
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "I couldn’t understand the assistant’s reply format. Please try again.",
      true
    );
  }

  decision = applyControlToDecision(
    decision,
    params.userMessage,
    Boolean(params.memory.userPreferences.doNotStartYet)
  );

  // Second pass after control preferences may have flipped
  const generationBlocked = shouldBlockGeneration({
    intent: decision.intent,
    doNotStartYet:
      Boolean(decision.memoryPatch.preferences?.doNotStartYet) ||
      Boolean(params.memory.userPreferences.doNotStartYet),
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
    };
  }

  return {
    decision,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    agentProfile: "agent",
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
  let memory: StoryMemory;
  if (
    record.memoryVersion === 2 ||
    record.storyMemory ||
    record.characters ||
    record.userPreferences ||
    record.story
  ) {
    memory = parseStoryMemory(record);
  } else {
    // Legacy create-state: seed lightly from draftForm/extraction if present
    const draft = (record.draftForm ?? record.extraction) as
      | Record<string, unknown>
      | undefined;
    if (!draft) return emptyStoryMemory();

    memory = applyMemoryPatch(emptyStoryMemory(), {
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
                typeof c === "object" &&
                c !== null &&
                typeof (c as { name?: unknown }).name === "string"
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

  return sanitizeStoryMemoryCanon(memory).memory;
}
