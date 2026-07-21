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
import {
  buildCanonicalStoryContext,
  serializeCanonicalStoryContext,
  summarizeCanonicalStoryContext,
  type CanonicalStoryContext,
} from "@/lib/story-agent/canonical-story-context";
import { logStoryGrounding } from "@/lib/story-agent/grounding-debug";
import { sanitizeStoryMemoryCanon } from "@/lib/story-agent/sanitize-memory";
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
import {
  buildSceneGenerationContract,
  retrieveStoryContext,
  serializeRetrievedStoryContext,
  serializeSceneGenerationContract,
} from "@/lib/story-agent/story-context-retriever";

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

function pickRelevantLeads(
  canonical: CanonicalStoryContext,
  sceneRequired: string[],
  softContext: string[]
): string[] {
  const fromContract = sceneRequired.filter(Boolean);
  if (fromContract.length > 0) return fromContract.slice(0, 4);
  const required = canonical.characters
    .filter((character) => character.required)
    .map((character) => character.name);
  if (required.length > 0) return required.slice(0, 4);
  if (softContext.length > 0) return softContext.slice(0, 4);
  return canonical.characters.slice(0, 4).map((character) => character.name);
}

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
  /** Authoritative raw canon preserved at the conversation boundary. */
  canonicalContext?: CanonicalStoryContext;
}): Promise<WriteSceneResult & { promptId?: string; promptVersion?: string }> {
  await assertWithinGenerationLimit(params.userId);
  await assertGenerationRateLimit(params.userId);

  const sanitized = sanitizeStoryMemoryCanon(params.memory);
  const memory = sanitized.memory;

  let ctx;
  try {
    ctx = buildStoryContext({
      operation: params.mode === "revise" ? "revise_draft" : "write_scene",
      memory,
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

  const resolved = resolveSceneRequest(params.userMessage, memory);
  const canonical =
    params.canonicalContext ??
    buildCanonicalStoryContext({
      conversationId: params.conversationId ?? "unspecified",
      storyId: params.storyId,
      memory,
      recentMessages: params.recentMessages ?? [],
      latestInstruction: params.userMessage,
    });
  const retrieval = retrieveStoryContext({
    memory,
    userMessage: params.userMessage,
    conversationId: params.conversationId,
    storyId: params.storyId,
    recentMessages: params.recentMessages,
    mode:
      params.mode === "revise"
        ? "REWRITE"
        : params.mode === "scene"
          ? "SCENE_GENERATION"
          : "OPENING",
  });
  const sceneContract = buildSceneGenerationContract(
    retrieval,
    params.userMessage
  );
  const retrievalBlock = serializeRetrievedStoryContext(retrieval);
  const sceneContractBlock = serializeSceneGenerationContract(sceneContract);
  const relevantLeads = pickRelevantLeads(
    canonical,
    sceneContract.requiredCharacters,
    resolved.softContextCharacters
  );

  let promptMeta: { promptId?: string; promptVersion?: string } = {};

  const buildPrompts = (
    strict: boolean,
    opts?: {
      violations?: string[];
      bannedNames?: string[];
      failedDraftPreview?: string;
    }
  ) => {
    const violations = opts?.violations ?? [];
    const bannedNames = opts?.bannedNames ?? [];
    const failedPreview = opts?.failedDraftPreview ?? "";
    const repairExtra = strict
      ? `
STRICT GROUNDED REPAIR (one attempt):
- ORIGINAL SYNOPSIS (authoritative):
${canonical.rawSynopsis || "Not supplied."}

- CANONICAL CHARACTERS: ${canonical.characters.map((c) => c.name).join(", ") || "None"}
- CANONICAL RELATIONSHIPS: ${
          canonical.relationships
            .map((r) => `${r.from} → ${r.to} (${r.type})`)
            .join("; ") || "None"
        }
- CONFLICT / PLOT ANCHORS: ${canonical.plotFacts.slice(0, 8).join(" | ") || "None"}
- CURRENT INSTRUCTION: ${params.userMessage}
- Center the live scene on at least one of: ${relevantLeads.join(", ") || "canonical leads"}.
- You may use a valid subset of the cast (do NOT force every character into one scene).
- Do NOT invent unrelated lead characters.
- Do NOT use these banned unrelated names from the failed draft: ${
          bannedNames.length > 0 ? bannedNames.join(", ") : "n/a"
        }.
- Do NOT use Business, Baat, Updated, Got, Hinglish, Liya, or Chahe as character names unless they are already canonical.
- Resolve grounding violations: ${violations.join(", ") || "context mismatch"}.
${failedPreview ? `- Failed draft preview (do not reuse):\n${failedPreview.slice(0, 400)}` : ""}
`
      : "";

    if (isPromptRegistryV2Enabled()) {
      const intent =
        params.intent ||
        (params.mode === "revise" ? "rewrite" : "write_scene");
      const built = composeCreateChatPrompt({
        intent,
        operation: params.mode === "revise" ? "revise_draft" : "write_scene",
        userMessage: params.userMessage,
        memory: getMemoryV2(memory),
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
      const canonicalBlock = serializeCanonicalStoryContext(canonical);
      return {
        system: parts.system,
        prompt: `${parts.prompt}\n\n${retrievalBlock}\n\n${sceneContractBlock}\n\n${canonicalBlock}${repairExtra}`,
        temperature: resolveTemperature(built.providerHints.temperatureProfile),
        maxOutputTokens: resolveMaxOutputTokens(
          built.providerHints.maxOutputTokensProfile
        ),
      };
    }

    if (params.mode === "revise") {
      const base = buildReviseDraftPrompt(ctx, ctx.languagePrefs, style);
      return {
        system: base.system,
        prompt: `${base.prompt}\n\n${serializeCanonicalStoryContext(canonical)}${repairExtra}`,
        temperature: 0.85,
        maxOutputTokens: 8192,
      };
    }
    const base = buildWriteScenePrompt(ctx, style);
    return {
      system: base.system,
      prompt: `${base.prompt}\n\n${retrievalBlock}\n\n${sceneContractBlock}\n\n${serializeCanonicalStoryContext(canonical)}${repairExtra}`,
      temperature: 0.85,
      maxOutputTokens: 8192,
    };
  };

  let { system, prompt, temperature, maxOutputTokens } = buildPrompts(false);
  if (isInstructionFidelityEnabled()) {
    ({ system, prompt } = appendContractToPrompt({
      system,
      prompt,
      memory,
      userMessage: params.userMessage,
      operation: params.mode === "revise" ? "revise_draft" : "write_scene",
    }));
  }

  logStoryGrounding("story_grounding.pre_provider", {
    conversationId: params.conversationId ?? null,
    storyId: params.storyId ?? null,
    rawSynopsisLength: canonical.rawSynopsis.length,
    rawSynopsisPreview: canonical.rawSynopsis.slice(0, 300),
    canonicalCharacterNames: canonical.characters.map((c) => c.name),
    requiredSceneCharacters: relevantLeads,
    relationships: canonical.relationships,
    plotAnchors: canonical.plotFacts.slice(0, 8),
    selectedGenerationMode: params.mode,
    selectedPromptKey: promptMeta.promptId ?? "legacy",
    removedPseudoEntities: sanitized.removedCharacterNames,
  });

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
  const prevTitle = memory.latestDraft?.title;
  const prevFp = memory.latestDraft?.content?.slice(0, 120) ?? null;
  let repairInvoked = false;
  let finalBranch: "initial_ok" | "repair_ok" | "both_failed" = "initial_ok";
  let initialViolations: string[] = [];
  let repairViolations: string[] = [];

  if (params.mode === "scene") {
    let relevance = assessDraftRelevance({
      userMessage: params.userMessage,
      title: result.title,
      content: result.content,
      resolved,
      canonicalContext: canonical,
      previousDraftTitle: prevTitle,
      previousDraftFingerprint: prevFp,
    });

    logStoryGrounding("story_grounding.initial_validation", {
      conversationId: params.conversationId ?? null,
      initialProvider: result.provider,
      initialOutputPreview: result.content.slice(0, 300),
      initialValidationViolationCodes: relevance.violationCodes,
      diagnostics: relevance.diagnostics,
      ok: relevance.ok,
    });

    if (!relevance.ok) {
      contextMismatch = true;
      relevanceRetry = true;
      repairInvoked = true;
      initialViolations = relevance.violationCodes;
      const bannedNames = relevance.foreignDominantNames.slice(0, 8);
      ({ system, prompt, temperature, maxOutputTokens } = buildPrompts(true, {
        violations: relevance.violationCodes,
        bannedNames,
        failedDraftPreview: `${result.title}\n${result.content}`,
      }));

      logStoryGrounding("story_grounding.repair_invoke", {
        conversationId: params.conversationId ?? null,
        repairPromptContextSummary: {
          relevantLeads,
          bannedNames,
          violationCodes: relevance.violationCodes,
          canonicalCharacterCount: canonical.characters.length,
          rawSynopsisLength: canonical.rawSynopsis.length,
        },
      });

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
        canonicalContext: canonical,
        previousDraftTitle: prevTitle,
        previousDraftFingerprint: prevFp,
      });
      repairViolations = relevance.violationCodes;

      logStoryGrounding("story_grounding.repair_validation", {
        conversationId: params.conversationId ?? null,
        repairProvider: result.provider,
        repairedOutputPreview: result.content.slice(0, 300),
        repairedValidationViolationCodes: relevance.violationCodes,
        diagnostics: relevance.diagnostics,
        ok: relevance.ok,
      });

      if (!relevance.ok) {
        finalBranch = "both_failed";
        logStoryGrounding("story_grounding.final", {
          conversationId: params.conversationId ?? null,
          finalReturnBranch: finalBranch,
          repairInvoked: true,
          initialValidationViolationCodes: initialViolations,
          repairedValidationViolationCodes: repairViolations,
          draftPersisted: false,
          creditConsumed: false,
        });
        throw new StoryAgentError(
          "CONTEXT_MISMATCH",
          "Generated scene did not match the requested characters or conflict. Previous draft kept.",
          { retryable: true, operation: "write_scene" }
        );
      }
      finalBranch = "repair_ok";
      contextMismatch = false;
    }
  }

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
      memory,
      userMessage: params.userMessage,
      operation: "write_scene",
      draft: out,
      provider: params.provider,
      languagePrefs: ctx.languagePrefs,
      canonicalContext: canonical,
      retrievedContext: retrieval,
    });
    out = {
      ...out,
      ...enforced.draft,
      draftKind: out.draftKind,
    };
    const repairedGrounding = assessDraftRelevance({
      userMessage: params.userMessage,
      title: out.title,
      content: out.content,
      resolved,
      previousDraftTitle: prevTitle,
      previousDraftFingerprint: prevFp,
      canonicalContext: canonical,
    });
    if (!repairedGrounding.ok) {
      logStoryGrounding("story_grounding.final", {
        conversationId: params.conversationId ?? null,
        finalReturnBranch: "fidelity_grounding_failed",
        repairInvoked,
        repairedValidationViolationCodes: repairedGrounding.violationCodes,
        draftPersisted: false,
        creditConsumed: false,
      });
      throw new StoryAgentError(
        "CONTEXT_MISMATCH",
        "Generated scene did not preserve the established story context. Previous draft kept.",
        { retryable: true, operation: "write_scene" }
      );
    }
  }

  // Credit only after a valid draft (initial or repaired) clears all gates.
  await incrementSuccessfulGeneration(params.userId);

  logStoryGrounding("story_grounding.final", {
    conversationId: params.conversationId ?? null,
    finalReturnBranch: finalBranch,
    repairInvoked,
    initialValidationViolationCodes: initialViolations,
    repairedValidationViolationCodes: repairViolations,
    draftPersisted: true,
    creditConsumed: true,
    outputPreview: out.content.slice(0, 300),
    canonical: summarizeCanonicalStoryContext(canonical),
  });

  return out;
}
