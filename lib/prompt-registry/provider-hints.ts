/**
 * Named provider hint profiles (Phase E) — no model names.
 */

export type TemperatureProfile = "deterministic" | "balanced" | "creative";
export type MaxOutputTokensProfile =
  | "short"
  | "medium"
  | "long"
  | "long_creative";
export type ReasoningProfile = "none" | "low";
export type JsonModeHint = "required" | "not_required";

export type ProviderHints = {
  temperatureProfile: TemperatureProfile;
  maxOutputTokensProfile: MaxOutputTokensProfile;
  reasoningProfile: ReasoningProfile;
  jsonMode: boolean;
};

export const TEMPERATURE_VALUES: Record<TemperatureProfile, number> = {
  deterministic: 0,
  balanced: 0.55,
  creative: 0.85,
};

export const MAX_OUTPUT_TOKEN_VALUES: Record<MaxOutputTokensProfile, number> = {
  short: 400,
  medium: 1400,
  long: 4096,
  long_creative: 8192,
};

export function resolveTemperature(profile: TemperatureProfile): number {
  return TEMPERATURE_VALUES[profile];
}

export function resolveMaxOutputTokens(
  profile: MaxOutputTokensProfile
): number {
  return MAX_OUTPUT_TOKEN_VALUES[profile];
}

export function defaultHints(partial?: Partial<ProviderHints>): ProviderHints {
  return {
    temperatureProfile: partial?.temperatureProfile ?? "balanced",
    maxOutputTokensProfile: partial?.maxOutputTokensProfile ?? "medium",
    reasoningProfile: partial?.reasoningProfile ?? "none",
    jsonMode: partial?.jsonMode ?? false,
  };
}
