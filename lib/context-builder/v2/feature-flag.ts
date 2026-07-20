/**
 * Feature flag for Dynamic Context Builder v2.
 */

export function isDynamicContextV2Enabled(): boolean {
  const raw = (process.env.AI_DYNAMIC_CONTEXT_V2_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
