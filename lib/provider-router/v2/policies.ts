/**
 * Operation generation policies (Phase F).
 */

import type {
  GenerationPolicy,
  GenerationPolicyId,
  GenerationRequest,
} from "@/lib/provider-router/v2/types";

function numEnv(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const POLICIES: Record<GenerationPolicyId, GenerationPolicy> = {
  classifier: {
    id: "classifier",
    modelProfile: "json_fast",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "short",
    reasoningProfile: "none",
    jsonMode: true,
    timeoutMs: numEnv("AI_POLICY_CLASSIFIER_TIMEOUT_MS", 4000),
    totalDeadlineMs: numEnv("AI_POLICY_CLASSIFIER_DEADLINE_MS", 8000),
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: false,
    jsonRepairAllowed: true,
    requiredCapabilities: ["json", "low_latency", "deterministic"],
    modelKind: "agent",
  },
  collaborative_chat: {
    id: "collaborative_chat",
    modelProfile: "balanced",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "medium",
    reasoningProfile: "none",
    jsonMode: true,
    timeoutMs: numEnv("AI_POLICY_CHAT_TIMEOUT_MS", 20_000),
    totalDeadlineMs: numEnv("AI_POLICY_CHAT_DEADLINE_MS", 40_000),
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: true,
    requiredCapabilities: ["json", "text"],
    modelKind: "agent",
  },
  normal_chat: {
    id: "normal_chat",
    modelProfile: "balanced",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    reasoningProfile: "none",
    jsonMode: false,
    timeoutMs: numEnv("AI_POLICY_CHAT_TIMEOUT_MS", 20_000),
    totalDeadlineMs: numEnv("AI_POLICY_CHAT_DEADLINE_MS", 40_000),
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: false,
    requiredCapabilities: ["text"],
    modelKind: "agent",
  },
  creative_scene: {
    id: "creative_scene",
    modelProfile: "long_creative",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    reasoningProfile: "none",
    jsonMode: false,
    timeoutMs: numEnv("AI_POLICY_SCENE_TIMEOUT_MS", 35_000),
    totalDeadlineMs: numEnv("AI_POLICY_SCENE_DEADLINE_MS", 70_000),
    maxAttemptsPerProvider: 2,
    maxTotalAttempts: 3,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: false,
    requiredCapabilities: ["text", "creative", "long_output"],
    modelKind: "creative",
  },
  creative_episode: {
    id: "creative_episode",
    modelProfile: "long_creative",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    reasoningProfile: "none",
    jsonMode: false,
    timeoutMs: numEnv("AI_POLICY_EPISODE_TIMEOUT_MS", 60_000),
    totalDeadlineMs: numEnv("AI_POLICY_EPISODE_DEADLINE_MS", 90_000),
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: false,
    requiredCapabilities: ["text", "creative", "long_output"],
    modelKind: "story",
  },
  revision: {
    id: "revision",
    modelProfile: "creative",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    reasoningProfile: "none",
    jsonMode: false,
    timeoutMs: numEnv("AI_POLICY_REVISION_TIMEOUT_MS", 35_000),
    totalDeadlineMs: numEnv("AI_POLICY_REVISION_DEADLINE_MS", 70_000),
    maxAttemptsPerProvider: 2,
    maxTotalAttempts: 3,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: false,
    requiredCapabilities: ["text", "creative"],
    modelKind: "creative",
  },
  knowledge: {
    id: "knowledge",
    modelProfile: "balanced",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    reasoningProfile: "none",
    jsonMode: false,
    timeoutMs: numEnv("AI_POLICY_KNOWLEDGE_TIMEOUT_MS", 20_000),
    totalDeadlineMs: numEnv("AI_POLICY_KNOWLEDGE_DEADLINE_MS", 40_000),
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: false,
    requiredCapabilities: ["text", "deterministic"],
    modelKind: "agent",
  },
  memory_json: {
    id: "memory_json",
    modelProfile: "json_fast",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    reasoningProfile: "none",
    jsonMode: true,
    timeoutMs: numEnv("AI_POLICY_MEMORY_TIMEOUT_MS", 20_000),
    totalDeadlineMs: numEnv("AI_POLICY_MEMORY_DEADLINE_MS", 40_000),
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: false,
    jsonRepairAllowed: true,
    requiredCapabilities: ["json", "deterministic"],
    modelKind: "agent",
  },
  default: {
    id: "default",
    modelProfile: "balanced",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    reasoningProfile: "none",
    jsonMode: false,
    timeoutMs: numEnv("AI_REQUEST_TIMEOUT_MS", 60_000),
    totalDeadlineMs: numEnv("AI_REQUEST_TIMEOUT_MS", 60_000) * 2,
    maxAttemptsPerProvider: 1,
    maxTotalAttempts: 2,
    fallbackAllowed: true,
    retryAllowed: true,
    jsonRepairAllowed: false,
    requiredCapabilities: ["text"],
    modelKind: "agent",
  },
};

export function getGenerationPolicy(input: {
  operation?: string;
  intent?: string;
  promptId?: string;
  classifier?: boolean;
  outputMode?: "text" | "json";
}): GenerationPolicy {
  if (input.classifier || input.promptId === "internal.intent_classifier") {
    return { ...POLICIES.classifier };
  }

  const promptId = input.promptId || "";
  const op = `${input.operation || ""} ${input.intent || ""} ${promptId}`.toLowerCase();

  if (
    promptId.startsWith("conversation.collaborative") ||
    op.includes("phase_a") ||
    op.includes("collaborative")
  ) {
    return { ...POLICIES.collaborative_chat };
  }
  if (promptId.startsWith("revision.") || op.includes("revise")) {
    return { ...POLICIES.revision };
  }
  if (
    promptId === "creative.episode" ||
    op.includes("generate_episode") ||
    op.includes("write_episode")
  ) {
    return { ...POLICIES.creative_episode };
  }
  if (
    promptId.startsWith("creative.") ||
    op.includes("write_scene") ||
    op.includes("story_agent_write")
  ) {
    return { ...POLICIES.creative_scene };
  }
  if (promptId.startsWith("knowledge.") || op.includes("question")) {
    return { ...POLICIES.knowledge };
  }
  if (
    promptId.startsWith("memory.") ||
    op.includes("memory_update") ||
    (input.outputMode === "json" && op.includes("memory"))
  ) {
    return { ...POLICIES.memory_json };
  }
  if (promptId.startsWith("conversation.") || op.includes("conversational")) {
    return { ...POLICIES.normal_chat };
  }
  if (input.outputMode === "json") {
    return { ...POLICIES.memory_json };
  }
  return { ...POLICIES.default };
}

export function mergePolicyWithRequest(
  policy: GenerationPolicy,
  request: GenerationRequest
): GenerationPolicy {
  const hints = request.prompt.providerHints;
  return {
    ...policy,
    temperatureProfile: hints.temperatureProfile || policy.temperatureProfile,
    maxOutputTokensProfile:
      hints.maxOutputTokensProfile || policy.maxOutputTokensProfile,
    reasoningProfile: hints.reasoningProfile || policy.reasoningProfile,
    jsonMode: request.prompt.outputMode === "json" || hints.jsonMode || policy.jsonMode,
    timeoutMs: request.constraints?.timeoutMs ?? policy.timeoutMs,
    totalDeadlineMs:
      request.constraints?.totalDeadlineMs ?? policy.totalDeadlineMs,
    maxAttemptsPerProvider:
      request.constraints?.maxAttemptsPerProvider ??
      policy.maxAttemptsPerProvider,
    maxTotalAttempts:
      request.constraints?.maxTotalAttempts ?? policy.maxTotalAttempts,
    fallbackAllowed:
      request.routing?.fallbackAllowed ?? policy.fallbackAllowed,
    retryAllowed: request.routing?.retryAllowed ?? policy.retryAllowed,
    preferredProvider:
      request.routing?.preferredProvider ?? policy.preferredProvider,
    modelKind: request.metadata?.modelKind ?? policy.modelKind,
  };
}

export function listGenerationPolicies(): GenerationPolicy[] {
  return Object.values(POLICIES).map((p) => ({ ...p }));
}
