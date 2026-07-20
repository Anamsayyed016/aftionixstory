/**
 * Feature flag for Prompt Registry v2 (Phase E).
 */

export function isPromptRegistryV2Enabled(): boolean {
  const raw = (process.env.AI_PROMPT_REGISTRY_V2_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
