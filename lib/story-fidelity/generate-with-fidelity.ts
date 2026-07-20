/**
 * Wrap creative generation with contract + validate + single repair (Phase G.5).
 */

import "server-only";

import { logAiEvent } from "@/lib/ai/logger";
import { generateCreativeText } from "@/lib/ai/services/creative-text";
import type { AIProvider } from "@/lib/ai/types";
import { StoryAgentError } from "@/lib/story-agent/errors";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { buildStoryGenerationContract, serializeGenerationContract } from "@/lib/story-fidelity/generation-contract";
import { validateStoryOutput } from "@/lib/story-fidelity/output-validator";
import {
  buildRepairPromptParts,
  summarizeValidationForLogs,
} from "@/lib/story-fidelity/repair";
import {
  readFidelityState,
  writeFidelityState,
} from "@/lib/story-fidelity/resolve-facts";
import {
  SAFE_GENERATION_FAILURE_MESSAGE,
} from "@/lib/story-fidelity/schemas";
import { isInstructionFidelityEnabled } from "@/lib/story-fidelity/feature-flag";
import {
  buildPrompt,
  isPromptRegistryV2Enabled,
  promptResultToLegacyParts,
} from "@/lib/prompt-registry";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";

export type FidelityDraft = {
  title: string;
  content: string;
  wordCount: number;
  provider: string;
  model: string;
  durationMs: number;
  retryCount: number;
  fidelityRepairAttempted?: boolean;
  fidelityValid?: boolean;
  fidelityScore?: number;
};

/**
 * Inject contract into an existing prompt pair.
 */
export function appendContractToPrompt(params: {
  system: string;
  prompt: string;
  memory: StoryMemory;
  userMessage: string;
  operation: string;
}): { system: string; prompt: string } {
  if (!isInstructionFidelityEnabled()) {
    return { system: params.system, prompt: params.prompt };
  }
  const state = readFidelityState(params.memory);
  const contract = buildStoryGenerationContract({
    facts: state.resolvedFacts,
    operation: params.operation,
    latestInstruction: params.userMessage,
  });
  const block = serializeGenerationContract(contract);
  return {
    system: `${params.system}\n\n${block}`,
    prompt: `${params.prompt}\n\n${block}`,
  };
}

/**
 * After a draft is produced, validate and optionally repair once.
 * Returns updated memory with validation summary metadata.
 */
export async function enforceInstructionFidelityOnDraft(params: {
  memory: StoryMemory;
  userMessage: string;
  operation: string;
  draft: FidelityDraft;
  provider?: AIProvider;
  languagePrefs?: unknown;
}): Promise<{
  draft: FidelityDraft;
  memory: StoryMemory;
}> {
  if (!isInstructionFidelityEnabled()) {
    return { draft: params.draft, memory: params.memory };
  }

  const started = Date.now();
  let state = readFidelityState(params.memory);
  const contract = buildStoryGenerationContract({
    facts: state.resolvedFacts,
    operation: params.operation,
    latestInstruction: params.userMessage,
  });

  // Skip heavy validation if no locked constraints
  const hasConstraints =
    contract.requiredCharacters.length > 0 ||
    Boolean(contract.requiredSetting) ||
    Boolean(contract.requiredLanguage) ||
    contract.requiredFormat.characterNameCase === "upper" ||
    contract.requiredFormat.emotionBracketFormat ||
    contract.requiredFormat.dialoguePlacement === "next_line" ||
    contract.requiredFormat.sceneDivision;

  if (!hasConstraints) {
    return { draft: params.draft, memory: params.memory };
  }

  let validation = validateStoryOutput({
    title: params.draft.title,
    content: params.draft.content,
    contract,
  });

  let draft = { ...params.draft, fidelityValid: validation.valid, fidelityScore: validation.score };
  let repairAttempted = false;

  if (!validation.valid && validation.repairable) {
    repairAttempted = true;
    let system: string;
    let prompt: string;

    if (isPromptRegistryV2Enabled()) {
      try {
        const built = buildPrompt({
          promptId: "story.repair.fidelity",
          intent: "rewrite",
          operation: params.operation,
          userMessage: params.userMessage,
          context: {
            contextVersion: 2,
            operation: params.operation,
            story: {
              title: null,
              concept: null,
              genre: [],
              tone: [],
              themes: [],
              setting: contract.requiredSetting,
            },
            characters: contract.requiredCharacters.map((c) => ({
              id: c.name,
              name: c.name,
              aliases: [],
              personalityTraits: [],
              goals: [],
              fears: [],
              strengths: [],
              weaknesses: [],
              notes: [],
              avoid: [],
              role: c.role,
            })),
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
            latestDraft: {
              title: params.draft.title,
              content: params.draft.content.slice(0, 8000),
              truncated: false,
              strategy: "full",
            },
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
            instructionContract: serializeGenerationContract(contract),
          },
          metadata: {
            revisionFocus: validation.violations.map((v) => v.code).join(","),
          },
        });
        const parts = promptResultToLegacyParts(built);
        system = parts.system;
        prompt = parts.prompt;
      } catch {
        const parts = buildRepairPromptParts({
          contract,
          validation,
          originalTitle: params.draft.title,
          originalContent: params.draft.content,
        });
        system = parts.system;
        prompt = parts.user;
      }
    } else {
      const parts = buildRepairPromptParts({
        contract,
        validation,
        originalTitle: params.draft.title,
        originalContent: params.draft.content,
      });
      system = parts.system;
      prompt = parts.user;
    }

    // Always append exact violations
    prompt = `${prompt}\n\nVIOLATIONS:\n${validation.violations
      .map((v) => `- ${v.code}: ${v.message}`)
      .join("\n")}\n\n${serializeGenerationContract(contract)}`;

    try {
      const repaired = await generateCreativeText({
        systemInstruction: system,
        prompt,
        operation: "story_fidelity_repair",
        temperature: 0.55,
        maxOutputTokens: 8192,
        provider: params.provider,
        languagePrefs: params.languagePrefs as never,
      });
      draft = {
        ...draft,
        title: repaired.title || draft.title,
        content: repaired.content,
        wordCount: repaired.wordCount,
        provider: repaired.provider,
        model: repaired.model,
        durationMs: draft.durationMs + repaired.durationMs,
        retryCount: draft.retryCount + 1,
        fidelityRepairAttempted: true,
      };
      validation = validateStoryOutput({
        title: draft.title,
        content: draft.content,
        contract,
      });
      draft.fidelityValid = validation.valid;
      draft.fidelityScore = validation.score;
    } catch {
      // fall through to safe failure
    }
  }

  state = {
    ...state,
    lastContractMeta: {
      operation: params.operation,
      requiredCharacterCount: contract.requiredCharacters.length,
      requiredSetting: contract.requiredSetting,
      requiredLanguage: contract.requiredLanguage,
      updatedAt: new Date().toISOString(),
    },
    lastValidationSummary: {
      valid: validation.valid,
      score: validation.score,
      violationCodes: validation.violations.map((v) => v.code),
      repairAttempted,
      updatedAt: new Date().toISOString(),
    },
  };

  const memory = writeFidelityState(params.memory, state);

  logAiEvent("info", "story_fidelity.validate", {
    ...summarizeValidationForLogs(validation, {
      repairAttempted,
      durationMs: Date.now() - started,
      operation: params.operation,
    }),
    requiredFactCount: contract.requiredCharacters.length,
    readinessReady: true,
    finalSuccess: validation.valid,
  });

  if (!validation.valid) {
    throw new StoryAgentError(
      "INSTRUCTION_FIDELITY_FAILED",
      SAFE_GENERATION_FAILURE_MESSAGE,
      { retryable: true, operation: params.operation }
    );
  }

  void getMemoryV2;
  return { draft, memory };
}
