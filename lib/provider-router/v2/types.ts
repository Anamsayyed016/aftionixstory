/**
 * Provider Router v2 — types (Phase F).
 */

import type { PromptMessage, PromptOutputMode } from "@/lib/prompt-registry/types";
import type { ProviderHints } from "@/lib/prompt-registry/provider-hints";
import type { ProviderId } from "@/lib/provider-router/v2/capabilities";
import type { ProviderErrorCode } from "@/lib/provider-router/v2/errors";

export type GenerationOutputMode = PromptOutputMode;

export type GenerationRouting = {
  preferredProvider?: ProviderId | null;
  allowedProviders?: ProviderId[];
  fallbackAllowed?: boolean;
  retryAllowed?: boolean;
};

export type GenerationConstraints = {
  timeoutMs?: number;
  maxAttemptsPerProvider?: number;
  maxTotalAttempts?: number;
  totalDeadlineMs?: number;
};

export type GenerationPromptPayload = {
  promptId: string;
  promptVersion: string;
  messages: PromptMessage[];
  outputMode: GenerationOutputMode;
  providerHints: ProviderHints;
};

export type GenerationRequest = {
  requestId: string;
  turnRequestId?: string;
  conversationId?: string;
  operation: string;
  intent?: string;
  prompt: GenerationPromptPayload;
  routing?: GenerationRouting;
  constraints?: GenerationConstraints;
  metadata?: {
    storyId?: string | null;
    episodeId?: string | null;
    classifier?: boolean;
    modelKind?: "agent" | "creative" | "story";
  };
};

export type AttemptRecord = {
  provider: ProviderId | string;
  attempt: number;
  success: boolean;
  latencyMs: number;
  errorCode: ProviderErrorCode | string | null;
  retryable: boolean;
};

export type GenerationUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimated: boolean;
};

export type GenerationValidation = {
  valid: boolean;
  repairUsed: boolean;
  warnings: string[];
};

export type GenerationResult = {
  requestId: string;
  provider: string;
  model: string;
  outputMode: GenerationOutputMode;
  text: string;
  json: unknown | null;
  finishReason: string;
  usage: GenerationUsage;
  attempts: AttemptRecord[];
  routing: {
    selectedProvider: string;
    fallbackUsed: boolean;
    fallbackReason: string | null;
  };
  validation: GenerationValidation;
  durationMs: number;
  promptId: string;
  promptVersion: string;
};

export type ProviderRawResult = {
  text: string;
  model: string;
  finishReason?: string;
  usage?: Partial<GenerationUsage>;
  durationMs: number;
  requestId?: string;
};

export type ProviderCapability =
  | "text"
  | "json"
  | "long_output"
  | "low_latency"
  | "deterministic"
  | "creative"
  | "streaming_future";

export type ProviderAdapter = {
  id: ProviderId;
  isConfigured(): boolean;
  supports(capability: ProviderCapability): boolean;
  generate(
    input: {
      messages: PromptMessage[];
      outputMode: GenerationOutputMode;
      temperature: number;
      maxOutputTokens: number;
      model: string;
      operation: string;
      signal?: AbortSignal;
      reasoningEffort?: "minimal" | "low" | "medium" | "high";
    },
    signal?: AbortSignal
  ): Promise<ProviderRawResult>;
  normalizeError(error: unknown): import("@/lib/provider-router/v2/errors").ProviderError;
};

export type ModelProfileId =
  | "fast"
  | "balanced"
  | "creative"
  | "long_creative"
  | "json_fast";

export type GenerationPolicyId =
  | "classifier"
  | "collaborative_chat"
  | "creative_scene"
  | "creative_episode"
  | "revision"
  | "knowledge"
  | "memory_json"
  | "normal_chat"
  | "default";

export type GenerationPolicy = {
  id: GenerationPolicyId;
  modelProfile: ModelProfileId;
  temperatureProfile: ProviderHints["temperatureProfile"];
  maxOutputTokensProfile: ProviderHints["maxOutputTokensProfile"];
  reasoningProfile: ProviderHints["reasoningProfile"];
  jsonMode: boolean;
  timeoutMs: number;
  totalDeadlineMs: number;
  maxAttemptsPerProvider: number;
  maxTotalAttempts: number;
  fallbackAllowed: boolean;
  retryAllowed: boolean;
  jsonRepairAllowed: boolean;
  preferredProvider?: ProviderId | null;
  requiredCapabilities: ProviderCapability[];
  modelKind: "agent" | "creative" | "story";
};
