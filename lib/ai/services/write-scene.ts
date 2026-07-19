import "server-only";

import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import { buildReviseDraftPrompt } from "@/lib/ai/prompts/revise-draft-prompt";
import { buildWriteScenePrompt } from "@/lib/ai/prompts/write-scene-prompt";
import { generateCreativeText } from "@/lib/ai/services/creative-text";
import type { AIProvider } from "@/lib/ai/types";
import type { StoryMemory } from "@/lib/story-agent/schema";
import {
  assertGenerationRateLimit,
  assertWithinGenerationLimit,
  incrementSuccessfulGeneration,
} from "@/lib/usage/generation";

export type WriteSceneResult = {
  title: string;
  content: string;
  wordCount: number;
  draftKind: "scene" | "rewrite";
  provider: string;
  model: string;
  durationMs: number;
  retryCount: number;
};

/**
 * Plain-text scene / revision writer. Does not require a Story DB row.
 * Does not parse JSON agent envelopes.
 */
export async function generateWriteScene(params: {
  userId: string;
  memory: StoryMemory;
  userMessage: string;
  mode: "scene" | "revise";
  provider?: AIProvider;
}): Promise<WriteSceneResult> {
  await assertWithinGenerationLimit(params.userId);
  await assertGenerationRateLimit(params.userId);

  const ctx = buildStoryContext({
    operation: params.mode === "revise" ? "revise_draft" : "write_scene",
    memory: params.memory,
    userMessage: params.userMessage,
  });

  const { system, prompt } =
    params.mode === "revise"
      ? buildReviseDraftPrompt(ctx)
      : buildWriteScenePrompt(ctx);

  const result = await generateCreativeText({
    systemInstruction: system,
    prompt,
    operation:
      params.mode === "revise"
        ? "story_agent_revise_draft"
        : "story_agent_write_scene",
    temperature: 0.85,
    maxOutputTokens: 4096,
    provider: params.provider,
  });

  await incrementSuccessfulGeneration(params.userId);

  return {
    title: result.title || (params.mode === "revise" ? "Revised draft" : "Scene draft"),
    content: result.content,
    wordCount: result.wordCount,
    draftKind: params.mode === "revise" ? "rewrite" : "scene",
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    retryCount: result.retryCount,
  };
}
