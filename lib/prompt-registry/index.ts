/**
 * Prompt Registry v2 — public exports (Phase E).
 */

export { PROMPT_IDS, isPromptId, type PromptId } from "@/lib/prompt-registry/ids";
export type {
  PromptCategory,
  PromptDefinition,
  PromptMessage,
  PromptOutputMode,
  PromptRequest,
  PromptResult,
  PromptLogSummary,
} from "@/lib/prompt-registry/types";
export {
  getPromptDefinition,
  listPromptDefinitions,
  getEnabledPromptDefinitions,
} from "@/lib/prompt-registry/registry";
export {
  resolvePromptId,
  listIntentPromptMappings,
  INTENT_TO_PROMPT,
  OPERATION_TO_PROMPT,
  type ResolvePromptIdInput,
} from "@/lib/prompt-registry/resolve";
export {
  buildPrompt,
  buildPromptById,
  composeCreateChatPrompt,
  promptResultToLegacyParts,
  type ComposeCreateChatPromptParams,
} from "@/lib/prompt-registry/build";
export {
  validatePromptRegistry,
  assertPromptRegistryValid,
} from "@/lib/prompt-registry/validate";
export {
  defaultHints,
  resolveTemperature,
  resolveMaxOutputTokens,
  type ProviderHints,
  type TemperatureProfile,
  type MaxOutputTokensProfile,
} from "@/lib/prompt-registry/provider-hints";
export { summarizePromptForLogs } from "@/lib/prompt-registry/log-summary";
export { promptLogFieldsForAiEvent } from "@/lib/prompt-registry/log-summary";
export { isPromptRegistryV2Enabled } from "@/lib/prompt-registry/feature-flag";
export {
  buildLanguageLayer,
  buildEmojiLayer,
  resolveEmojiLevel,
  formatWritingRulesForPrompt,
  conflictPriorityPreamble,
  platformIdentity,
  mirrorUserLanguageStyle,
} from "@/lib/prompt-registry/layers";
