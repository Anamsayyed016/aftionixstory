/**
 * Model profile resolution (Phase F) — no model names in business logic.
 */

import type { ProviderId } from "@/lib/provider-router/v2/capabilities";
import type { ModelProfileId } from "@/lib/provider-router/v2/types";
import {
  getAiEnv,
  resolveAgentModelForProvider,
  resolveCreativeModelForProvider,
  resolveStoryModelForProvider,
  type AiProviderLive,
} from "@/lib/env";

function envOr(key: string, fallback: string): string {
  const v = (process.env[key] || "").trim();
  return v || fallback;
}

export function resolveModelForProfile(
  provider: ProviderId,
  profile: ModelProfileId
): string {
  if (provider === "mock") return "mock";

  const live = provider as AiProviderLive;
  const env = getAiEnv();

  if (provider === "openai") {
    switch (profile) {
      case "fast":
      case "json_fast":
        return envOr(
          "OPENAI_MODEL_FAST",
          envOr("OPENAI_MODEL_JSON_FAST", env.OPENAI_SUMMARY_MODEL)
        );
      case "balanced":
        return envOr(
          "OPENAI_MODEL_BALANCED",
          resolveAgentModelForProvider(live)
        );
      case "creative":
        return envOr(
          "OPENAI_MODEL_CREATIVE",
          resolveCreativeModelForProvider(live)
        );
      case "long_creative":
        return envOr(
          "OPENAI_MODEL_LONG_CREATIVE",
          resolveCreativeModelForProvider(live)
        );
      default:
        return resolveAgentModelForProvider(live);
    }
  }

  // gemini
  switch (profile) {
    case "fast":
    case "json_fast":
      return envOr(
        "GEMINI_MODEL_FAST",
        envOr("GEMINI_MODEL_JSON_FAST", env.GEMINI_SUMMARY_MODEL)
      );
    case "balanced":
      return envOr(
        "GEMINI_MODEL_BALANCED",
        resolveAgentModelForProvider(live)
      );
    case "creative":
      return envOr(
        "GEMINI_MODEL_CREATIVE",
        resolveCreativeModelForProvider(live)
      );
    case "long_creative":
      return envOr(
        "GEMINI_MODEL_LONG_CREATIVE",
        resolveStoryModelForProvider(live)
      );
    default:
      return resolveAgentModelForProvider(live);
  }
}
