import "server-only";

import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import { buildReviseDraftPrompt } from "@/lib/ai/prompts/revise-draft-prompt";
import { buildWriteScenePrompt } from "@/lib/ai/prompts/write-scene-prompt";
import { generateCreativeText } from "@/lib/ai/services/creative-text";
import type { AIProvider } from "@/lib/ai/types";
import { assessDraftRelevance } from "@/lib/story-agent/draft-relevance";
import { resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import { StoryAgentError } from "@/lib/story-agent/errors";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { readStyleProfile } from "@/lib/story-agent/style-profile";
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
  languageComplianceRetry?: boolean;
  contextMismatch?: boolean;
  relevanceRetry?: boolean;
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
  conversationId?: string;
  storyId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  provider?: AIProvider;
}): Promise<WriteSceneResult> {
  await assertWithinGenerationLimit(params.userId);
  await assertGenerationRateLimit(params.userId);

  let ctx;
  try {
    ctx = buildStoryContext({
      operation: params.mode === "revise" ? "revise_draft" : "write_scene",
      memory: params.memory,
      userMessage: params.userMessage,
      recentMessages: params.recentMessages,
      conversationId: params.conversationId,
      storyId: params.storyId,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CONTEXT_ISOLATION_ERROR"
    ) {
      throw new StoryAgentError(
        "CONTEXT_ISOLATION_ERROR",
        "Context isolation failed — refusing to use another conversation’s draft.",
        { retryable: false, operation: "write_scene" }
      );
    }
    throw error;
  }

  const style = readStyleProfile({
    formality: params.memory.userPreferences.formality,
    dialogueStyle: params.memory.userPreferences.dialogueStyle,
    narrationStyle: params.memory.userPreferences.narrationStyle,
    emojiStyle: params.memory.userPreferences.emojiStyle,
    uppercaseForLoudDialogue:
      params.memory.userPreferences.uppercaseForLoudDialogue,
    episodeLength: params.memory.userPreferences.episodeLength,
    avoidFormalHindi: params.memory.userPreferences.avoidFormalHindi,
    preferShortDialogues: params.memory.userPreferences.preferShortDialogues,
    pacingHint: params.memory.userPreferences.pacingHint,
    avoid: params.memory.userPreferences.avoid,
  });

  const resolved = resolveSceneRequest(params.userMessage, params.memory);

  const buildPrompts = (strict: boolean) => {
    if (params.mode === "revise") {
      return buildReviseDraftPrompt(ctx, ctx.languagePrefs, style);
    }
    const base = buildWriteScenePrompt(ctx, style);
    if (!strict || resolved.characterNames.length === 0) return base;
    return {
      system: base.system,
      prompt: `${base.prompt}

STRICT RELEVANCE CORRECTION:
- The previous attempt used the wrong characters or setup.
- You MUST center the scene on: ${resolved.characterNames.join(", ")}.
- Do NOT use any other lead characters.
- Honor the current request exactly: ${params.userMessage}`,
    };
  };

  let { system, prompt } = buildPrompts(false);
  let result = await generateCreativeText({
    systemInstruction: system,
    prompt,
    operation:
      params.mode === "revise"
        ? "story_agent_revise_draft"
        : "story_agent_write_scene",
    temperature: 0.85,
    maxOutputTokens: 8192,
    provider: params.provider,
    languagePrefs: ctx.languagePrefs,
  });

  let relevanceRetry = false;
  let contextMismatch = false;
  const prevTitle = params.memory.latestDraft?.title;
  const prevFp = params.memory.latestDraft?.content?.slice(0, 120) ?? null;

  if (params.mode === "scene") {
    let relevance = assessDraftRelevance({
      userMessage: params.userMessage,
      title: result.title,
      content: result.content,
      resolved,
      previousDraftTitle: prevTitle,
      previousDraftFingerprint: prevFp,
    });

    console.info(
      JSON.stringify({
        event: "write_scene.relevance",
        conversationId: params.conversationId ?? null,
        operation: "write_scene",
        requestedEntityFingerprints: resolved.fingerprints,
        generatedEntityFingerprints: relevance.generatedNameFingerprints,
        contextMismatch: !relevance.ok,
        reason: relevance.reason ?? null,
        promptSections: ctx.promptSectionNames,
        provider: result.provider,
        model: result.model,
      })
    );

    if (!relevance.ok) {
      contextMismatch = true;
      relevanceRetry = true;
      ({ system, prompt } = buildPrompts(true));
      result = await generateCreativeText({
        systemInstruction: system,
        prompt,
        operation: "story_agent_write_scene",
        temperature: 0.7,
        maxOutputTokens: 8192,
        provider: params.provider,
        languagePrefs: ctx.languagePrefs,
      });
      relevance = assessDraftRelevance({
        userMessage: params.userMessage,
        title: result.title,
        content: result.content,
        resolved,
        previousDraftTitle: prevTitle,
        previousDraftFingerprint: prevFp,
      });
      if (!relevance.ok) {
        throw new StoryAgentError(
          "CONTEXT_MISMATCH",
          "Generated scene did not match the requested characters or conflict. Previous draft kept.",
          { retryable: true, operation: "write_scene" }
        );
      }
      contextMismatch = false;
    }
  }

  await incrementSuccessfulGeneration(params.userId);

  return {
    title:
      result.title ||
      (params.mode === "revise" ? "Revised draft" : "Scene draft"),
    content: result.content,
    wordCount: result.wordCount,
    draftKind: params.mode === "revise" ? "rewrite" : "scene",
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    retryCount: result.retryCount + (relevanceRetry ? 1 : 0),
    languageComplianceRetry: result.languageComplianceRetry,
    contextMismatch,
    relevanceRetry,
  };
}
