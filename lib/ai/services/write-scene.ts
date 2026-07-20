import "server-only";

import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import { buildReviseDraftPrompt } from "@/lib/ai/prompts/revise-draft-prompt";
import { buildWriteScenePrompt } from "@/lib/ai/prompts/write-scene-prompt";
import { logAiEvent } from "@/lib/ai/logger";
import { generateCreativeText } from "@/lib/ai/services/creative-text";
import type { AIProvider } from "@/lib/ai/types";
import { assessDraftRelevance } from "@/lib/story-agent/draft-relevance";
import { resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import { StoryAgentError } from "@/lib/story-agent/errors";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { readStyleProfile } from "@/lib/story-agent/style-profile";
import {
  assertGenerationRateLimit,
  assertWithinGenerationLimit,
  incrementSuccessfulGeneration,
} from "@/lib/usage/generation";
import {
  composeCreateChatPrompt,
  isPromptRegistryV2Enabled,
  promptResultToLegacyParts,
  resolveTemperature,
  resolveMaxOutputTokens,
  promptLogFieldsForAiEvent,
} from "@/lib/prompt-registry";
import {
  appendContractToPrompt,
  enforceInstructionFidelityOnDraft,
} from "@/lib/story-fidelity/generate-with-fidelity";
import { isInstructionFidelityEnabled } from "@/lib/story-fidelity/feature-flag";

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
  /** Phase B/E intent for revision-specific prompts */
  intent?: string | null;
}): Promise<WriteSceneResult & { promptId?: string; promptVersion?: string }> {
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

  let promptMeta: { promptId?: string; promptVersion?: string } = {};

  const buildPrompts = (strict: boolean) => {
    if (isPromptRegistryV2Enabled()) {
      const intent =
        params.intent ||
        (params.mode === "revise" ? "rewrite" : "write_scene");
      const built = composeCreateChatPrompt({
        intent,
        operation: params.mode === "revise" ? "revise_draft" : "write_scene",
        userMessage: params.userMessage,
        memory: getMemoryV2(params.memory),
        recentMessages: params.recentMessages,
        conversationId: params.conversationId,
        storyId: params.storyId,
      });
      promptMeta = {
        promptId: built.promptId,
        promptVersion: built.promptVersion,
      };
      logAiEvent("info", "prompt_registry.build", {
        ...promptLogFieldsForAiEvent(built),
        conversationId: params.conversationId,
      });
      const parts = promptResultToLegacyParts(built);
      if (!strict || resolved.characterNames.length === 0) {
        return {
          ...parts,
          temperature: resolveTemperature(built.providerHints.temperatureProfile),
          maxOutputTokens: resolveMaxOutputTokens(
            built.providerHints.maxOutputTokensProfile
          ),
        };
      }
      return {
        system: parts.system,
        prompt: `${parts.prompt}

STRICT RELEVANCE CORRECTION:
- The previous attempt used the wrong characters or setup.
- You MUST center the scene on: ${resolved.characterNames.join(", ")}.
- Do NOT use any other lead characters.
- Honor the current request exactly: ${params.userMessage}`,
        temperature: resolveTemperature(built.providerHints.temperatureProfile),
        maxOutputTokens: resolveMaxOutputTokens(
          built.providerHints.maxOutputTokensProfile
        ),
      };
    }

    if (params.mode === "revise") {
      const base = buildReviseDraftPrompt(ctx, ctx.languagePrefs, style);
      return { ...base, temperature: 0.85, maxOutputTokens: 8192 };
    }
    const base = buildWriteScenePrompt(ctx, style);
    if (!strict || resolved.characterNames.length === 0) {
      return { ...base, temperature: 0.85, maxOutputTokens: 8192 };
    }
    return {
      system: base.system,
      prompt: `${base.prompt}

STRICT RELEVANCE CORRECTION:
- The previous attempt used the wrong characters or setup.
- You MUST center the scene on: ${resolved.characterNames.join(", ")}.
- Do NOT use any other lead characters.
- Honor the current request exactly: ${params.userMessage}`,
      temperature: 0.85,
      maxOutputTokens: 8192,
    };
  };

  let { system, prompt, temperature, maxOutputTokens } = buildPrompts(false);
  if (isInstructionFidelityEnabled()) {
    ({ system, prompt } = appendContractToPrompt({
      system,
      prompt,
      memory: params.memory,
      userMessage: params.userMessage,
      operation: params.mode === "revise" ? "revise_draft" : "write_scene",
    }));
  }
  let result = await generateCreativeText({
    systemInstruction: system,
    prompt,
    operation:
      params.mode === "revise"
        ? "story_agent_revise_draft"
        : "story_agent_write_scene",
    temperature,
    maxOutputTokens,
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
      ({ system, prompt, temperature, maxOutputTokens } = buildPrompts(true));
      result = await generateCreativeText({
        systemInstruction: system,
        prompt,
        operation: "story_agent_write_scene",
        temperature: Math.min(temperature, 0.7),
        maxOutputTokens,
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

  let out = {
    title:
      result.title ||
      (params.mode === "revise" ? "Revised draft" : "Scene draft"),
    content: result.content,
    wordCount: result.wordCount,
    draftKind: (params.mode === "revise" ? "rewrite" : "scene") as
      | "scene"
      | "rewrite",
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    retryCount: result.retryCount + (relevanceRetry ? 1 : 0),
    languageComplianceRetry: result.languageComplianceRetry,
    contextMismatch,
    relevanceRetry,
    ...promptMeta,
  };

  if (isInstructionFidelityEnabled() && params.mode === "scene") {
    const enforced = await enforceInstructionFidelityOnDraft({
      memory: params.memory,
      userMessage: params.userMessage,
      operation: "write_scene",
      draft: out,
      provider: params.provider,
      languagePrefs: ctx.languagePrefs,
    });
    out = {
      ...out,
      ...enforced.draft,
      draftKind: out.draftKind,
    };
  }

  return out;
}
