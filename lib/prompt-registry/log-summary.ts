/**
 * Safe prompt log summary — never includes prompt text or draft (Phase E).
 */

import type { PromptLogSummary, PromptResult } from "@/lib/prompt-registry/types";

export function summarizePromptForLogs(result: PromptResult): PromptLogSummary {
  return {
    promptId: result.promptId,
    promptVersion: result.promptVersion,
    outputMode: result.outputMode,
    messageCount: result.messages.length,
    estimatedPromptTokens: result.debug.estimatedPromptTokens,
    includedSections: result.debug.includedSections,
  };
}

/** Flat fields safe for logAiEvent (no arrays). */
export function promptLogFieldsForAiEvent(
  result: PromptResult
): Record<string, string | number | boolean> {
  const s = summarizePromptForLogs(result);
  return {
    promptId: s.promptId,
    promptVersion: s.promptVersion,
    outputMode: s.outputMode,
    messageCount: s.messageCount,
    estimatedPromptTokens: s.estimatedPromptTokens,
    includedSections: s.includedSections.join(","),
  };
}
