/**
 * Provider Router v2 — public exports (Phase F).
 */

export { isProviderRouterV2Enabled } from "@/lib/provider-router/v2/feature-flag";
export {
  generate,
  generateText,
  generateJson,
  buildGenerationRequestFromPromptResult,
  buildGenerationRequestFromSystemPrompt,
  generationResultToLegacyText,
  type GatewayGenerateOptions,
} from "@/lib/provider-router/v2/gateway";
export {
  getGenerationPolicy,
  mergePolicyWithRequest,
  listGenerationPolicies,
} from "@/lib/provider-router/v2/policies";
export { selectProviders } from "@/lib/provider-router/v2/select-provider";
export {
  getProviderAdapter,
  listConfiguredProviders,
  validateProviderRegistry,
  registerProviderAdapter,
  getProviderCapabilities,
  __setProviderAdaptersForTests,
  __resetProviderRegistryForTests,
} from "@/lib/provider-router/v2/provider-registry";
export {
  resetRouterCircuitsForTests,
  routerCircuitSnapshot,
  isCircuitBreakerEnabled,
} from "@/lib/provider-router/v2/circuit-breaker";
export { __clearGenerationDedupeForTests } from "@/lib/provider-router/v2/deduplicate";
export { createMockAdapter } from "@/lib/provider-router/adapters/mock";
export {
  makeProviderError,
  isProviderError,
  userFacingGenerationMessage,
  PROVIDER_ERROR_CODES,
  type ProviderError,
  type ProviderErrorCode,
} from "@/lib/provider-router/v2/errors";
export type {
  GenerationRequest,
  GenerationResult,
  GenerationPolicy,
  ProviderAdapter,
  AttemptRecord,
} from "@/lib/provider-router/v2/types";
export type { ProviderId } from "@/lib/provider-router/v2/capabilities";
export { validateTextOutput } from "@/lib/provider-router/v2/validate-output";
export { parseProviderJson } from "@/lib/provider-router/v2/json-output";
export { generateTextCompat } from "@/lib/provider-router/v2/legacy-generate";
