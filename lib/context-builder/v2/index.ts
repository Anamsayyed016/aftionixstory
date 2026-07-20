/**
 * Dynamic Context Builder v2 — public exports (Phase D).
 */

export {
  buildDynamicContext,
  buildContextRequestFromPlan,
} from "@/lib/context-builder/v2/builder";
export {
  dynamicContextSchema,
  CONTEXT_VERSION,
  DEFAULT_CONTEXT_LIMITS,
  type DynamicContext,
  type ContextLimits,
} from "@/lib/context-builder/v2/schema";
export {
  type ContextRequest,
  emptyEntities,
  normalizeLimits,
} from "@/lib/context-builder/v2/request";
export {
  resolveOperationProfile,
  type OperationProfile,
} from "@/lib/context-builder/v2/profiles";
export {
  serializeDynamicContextForPrompt,
  serializeCreativeContext,
  serializeRevisionContext,
  serializeCharacterQuestionContext,
  serializeKnowledgeContext,
  serializePreferenceContext,
} from "@/lib/context-builder/v2/serialize";
export {
  dynamicContextToCompactStoryContext,
  dynamicContextToLegacyOperationContext,
  dynamicContextToLegacyStoryMemory,
  contextPromptBlock,
} from "@/lib/context-builder/v2/legacy-adapter";
export {
  summarizeContextForLogs,
  type ContextLogSummary,
} from "@/lib/context-builder/v2/log-summary";
export { isDynamicContextV2Enabled } from "@/lib/context-builder/v2/feature-flag";
export { estimateTokens, estimateContextTokens } from "@/lib/context-builder/v2/token-budget";
