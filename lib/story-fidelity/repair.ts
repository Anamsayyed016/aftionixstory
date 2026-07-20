/**
 * Single repair attempt for fidelity failures (Phase G.5).
 */

import type { StoryGenerationContract, StoryValidationResult } from "@/lib/story-fidelity/schemas";
import { serializeGenerationContract } from "@/lib/story-fidelity/generation-contract";

export function buildRepairPromptParts(params: {
  contract: StoryGenerationContract;
  validation: StoryValidationResult;
  originalTitle?: string;
  originalContent: string;
}): { system: string; user: string } {
  const violationLines = params.validation.violations
    .map((v) => `- [${v.code}] ${v.message}`)
    .join("\n");

  const system = [
    "You are StoryVerse's fidelity repair writer.",
    "Return ONLY the corrected story output (optional TITLE: line, then prose).",
    "Do not explain the correction.",
    "Preserve useful content only if compatible with the contract.",
    "Replace unrelated characters with the required leads.",
    "Restore locked setting, language, and format rules.",
    serializeGenerationContract(params.contract),
  ].join("\n\n");

  const user = [
    "VALIDATIONS FAILED:",
    violationLines || "- (unspecified)",
    "",
    "ORIGINAL DRAFT (fix in place):",
    params.originalTitle ? `TITLE: ${params.originalTitle}` : "",
    params.originalContent.slice(0, 12000),
    "",
    "Write the corrected story now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export function summarizeValidationForLogs(
  validation: StoryValidationResult,
  extra?: { repairAttempted?: boolean; durationMs?: number; operation?: string }
): Record<string, unknown> {
  return {
    operation: extra?.operation,
    validationScore: validation.score,
    valid: validation.valid,
    violationCodes: validation.violations.map((v) => v.code),
    violationCount: validation.violations.length,
    repairable: validation.repairable,
    repairAttempted: Boolean(extra?.repairAttempted),
    durationMs: extra?.durationMs,
  };
}
