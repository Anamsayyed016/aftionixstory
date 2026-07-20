/**
 * Feature flag for Provider Router v2 (Phase F).
 */

export function isProviderRouterV2Enabled(): boolean {
  const raw = (process.env.AI_PROVIDER_ROUTER_V2_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
