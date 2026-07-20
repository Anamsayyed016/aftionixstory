/**
 * Provider adapter registry (Phase F).
 */

import { createGeminiAdapter } from "@/lib/provider-router/adapters/gemini";
import { createOpenAIAdapter } from "@/lib/provider-router/adapters/openai";
import type { ProviderId } from "@/lib/provider-router/v2/capabilities";
import { PROVIDER_IDS } from "@/lib/provider-router/v2/capabilities";
import type { ProviderAdapter, ProviderCapability } from "@/lib/provider-router/v2/types";

const adapters = new Map<ProviderId, ProviderAdapter>();

function ensureDefaults() {
  if (!adapters.has("openai")) adapters.set("openai", createOpenAIAdapter());
  if (!adapters.has("gemini")) adapters.set("gemini", createGeminiAdapter());
}

export function registerProviderAdapter(adapter: ProviderAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getProviderAdapter(id: ProviderId | string): ProviderAdapter | null {
  ensureDefaults();
  return adapters.get(id as ProviderId) ?? null;
}

export function listConfiguredProviders(): ProviderAdapter[] {
  ensureDefaults();
  return [...adapters.values()].filter((a) => a.isConfigured());
}

export function listAllProviderAdapters(): ProviderAdapter[] {
  ensureDefaults();
  return [...adapters.values()];
}

export function getProviderCapabilities(
  providerId: ProviderId
): ProviderCapability[] {
  const adapter = getProviderAdapter(providerId);
  if (!adapter) return [];
  const all: ProviderCapability[] = [
    "text",
    "json",
    "long_output",
    "low_latency",
    "deterministic",
    "creative",
    "streaming_future",
  ];
  return all.filter((c) => adapter.supports(c));
}

export type ProviderRegistryValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateProviderRegistry(): ProviderRegistryValidation {
  ensureDefaults();
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const adapter of adapters.values()) {
    if (seen.has(adapter.id)) errors.push(`duplicate provider id: ${adapter.id}`);
    seen.add(adapter.id);
    if (!PROVIDER_IDS.includes(adapter.id)) {
      errors.push(`unknown provider id: ${adapter.id}`);
    }
    if (typeof adapter.isConfigured !== "function") {
      errors.push(`missing isConfigured: ${adapter.id}`);
    }
    if (typeof adapter.generate !== "function") {
      errors.push(`missing generate: ${adapter.id}`);
    }
    if (typeof adapter.supports !== "function") {
      errors.push(`missing supports: ${adapter.id}`);
    }
    if (typeof adapter.normalizeError !== "function") {
      errors.push(`missing normalizeError: ${adapter.id}`);
    }
  }

  for (const id of ["openai", "gemini"] as const) {
    const a = adapters.get(id);
    if (a && !a.isConfigured()) {
      warnings.push(`${id} adapter present but not configured`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Test helper — replace adapters entirely. */
export function __setProviderAdaptersForTests(
  list: ProviderAdapter[]
): void {
  adapters.clear();
  for (const a of list) adapters.set(a.id, a);
}

export function __resetProviderRegistryForTests(): void {
  adapters.clear();
}
