/**
 * Phase F circuit breaker — wraps in-process breaker with env config.
 */

import {
  canAttemptProvider,
  getCircuitSnapshot,
  recordProviderNonTransientFailure,
  recordProviderSuccess,
  recordProviderTransientFailure,
  __resetCircuitBreakersForTests,
  type CircuitSnapshot,
} from "@/lib/ai/circuit-breaker";

export function isCircuitBreakerEnabled(): boolean {
  const raw = (process.env.AI_PROVIDER_CIRCUIT_BREAKER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function routerCanAttempt(provider: string, model?: string): boolean {
  if (!isCircuitBreakerEnabled()) return true;
  return canAttemptProvider(provider, model);
}

export function routerRecordSuccess(provider: string, model?: string): void {
  if (!isCircuitBreakerEnabled()) return;
  recordProviderSuccess(provider, model);
}

export function routerRecordTransientFailure(
  provider: string,
  model?: string
): void {
  if (!isCircuitBreakerEnabled()) return;
  recordProviderTransientFailure(provider, model);
}

export function routerRecordNonTransientFailure(
  provider: string,
  model?: string
): void {
  if (!isCircuitBreakerEnabled()) return;
  recordProviderNonTransientFailure(provider, model);
}

export function routerCircuitSnapshot(
  provider: string,
  model?: string
): CircuitSnapshot {
  return getCircuitSnapshot(provider, model);
}

export function resetRouterCircuitsForTests(): void {
  __resetCircuitBreakersForTests();
}

export type { CircuitSnapshot };
