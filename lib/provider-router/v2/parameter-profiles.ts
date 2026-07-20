/**
 * Map Prompt Registry hints → concrete generation parameters (Phase F).
 */

import type { ProviderHints } from "@/lib/prompt-registry/provider-hints";
import {
  resolveMaxOutputTokens,
  resolveTemperature,
} from "@/lib/prompt-registry/provider-hints";

export type ResolvedGenerationParams = {
  temperature: number;
  maxOutputTokens: number;
  reasoningEffort: "minimal" | "low" | undefined;
  jsonMode: boolean;
};

export function resolveParameterProfiles(
  hints: ProviderHints
): ResolvedGenerationParams {
  const temperature = resolveTemperature(hints.temperatureProfile);
  const maxOutputTokens = resolveMaxOutputTokens(hints.maxOutputTokensProfile);
  const reasoningEffort =
    hints.reasoningProfile === "low" ? ("low" as const) : ("minimal" as const);

  return {
    temperature: Math.min(1, Math.max(0, temperature)),
    maxOutputTokens: Math.min(16_384, Math.max(64, maxOutputTokens)),
    reasoningEffort,
    jsonMode: Boolean(hints.jsonMode),
  };
}
