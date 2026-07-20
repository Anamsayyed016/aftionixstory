/**
 * Provider IDs and capability declarations (Phase F).
 */

export const PROVIDER_IDS = ["openai", "gemini", "mock"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}
