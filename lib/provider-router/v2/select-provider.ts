/**
 * Provider selection (Phase F).
 */

import type { ProviderId } from "@/lib/provider-router/v2/capabilities";
import { isProviderId } from "@/lib/provider-router/v2/capabilities";
import { routerCanAttempt } from "@/lib/provider-router/v2/circuit-breaker";
import type { ProviderAdapter } from "@/lib/provider-router/v2/types";
import type { GenerationPolicy } from "@/lib/provider-router/v2/types";
import { getProviderAdapter, listConfiguredProviders } from "@/lib/provider-router/v2/provider-registry";
import { resolveFailoverProviders, getAiEnv } from "@/lib/env";

export function selectProviders(input: {
  policy: GenerationPolicy;
  preferredProvider?: ProviderId | null;
  allowedProviders?: ProviderId[];
  injectAdapters?: ProviderAdapter[];
}): ProviderAdapter[] {
  const configured =
    input.injectAdapters?.filter((a) => a.isConfigured()) ??
    listConfiguredProviders();

  const allowed = new Set<ProviderId>(
    (input.allowedProviders?.length
      ? input.allowedProviders
      : configured.map((a) => a.id)
    ).filter(isProviderId)
  );

  const ordered: ProviderId[] = [];
  const preferred = input.preferredProvider || input.policy.preferredProvider;
  if (preferred && allowed.has(preferred)) ordered.push(preferred);

  // When adapters are injected (tests), preserve their order after preferred.
  if (input.injectAdapters?.length) {
    for (const a of input.injectAdapters) {
      if (allowed.has(a.id) && !ordered.includes(a.id) && a.isConfigured()) {
        ordered.push(a.id);
      }
    }
  } else {
    // Env failover order
    try {
      const env = getAiEnv();
      if (env.AI_PROVIDER !== "mock") {
        const pair = resolveFailoverProviders(env);
        if (
          pair.primary &&
          allowed.has(pair.primary) &&
          !ordered.includes(pair.primary)
        ) {
          ordered.push(pair.primary);
        }
        if (
          pair.fallback &&
          allowed.has(pair.fallback) &&
          !ordered.includes(pair.fallback)
        ) {
          ordered.push(pair.fallback);
        }
      }
    } catch {
      // ignore env parse in unit tests with injectAdapters
    }

    for (const a of configured) {
      if (allowed.has(a.id) && !ordered.includes(a.id)) ordered.push(a.id);
    }
  }

  const result: ProviderAdapter[] = [];
  for (const id of ordered) {
    const adapter =
      input.injectAdapters?.find((a) => a.id === id) ?? getProviderAdapter(id);
    if (!adapter || !adapter.isConfigured()) continue;
    if (!routerCanAttempt(adapter.id)) continue;

    const capsOk = input.policy.requiredCapabilities.every((c) =>
      adapter.supports(c)
    );
    if (!capsOk) continue;
    result.push(adapter);
  }

  return result;
}
