/**
 * In-process circuit breaker per provider/model.
 *
 * States: CLOSED → OPEN (after N transient failures in a window) → HALF_OPEN
 * (after cooldown, one probe) → CLOSED on success.
 *
 * Suitable for a single VPS app instance. Multi-instance deployments need a
 * shared store (e.g. Redis) so open circuits are visible across processes.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitSnapshot = {
  key: string;
  state: CircuitState;
  failureCount: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  openedAt: number | null;
};

type CircuitEntry = {
  failures: number[];
  state: CircuitState;
  openedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  halfOpenInFlight: boolean;
};

const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 2 * 60_000;
const COOLDOWN_MS = 60_000;

const circuits = new Map<string, CircuitEntry>();

function now() {
  return Date.now();
}

function getOrCreate(key: string): CircuitEntry {
  let entry = circuits.get(key);
  if (!entry) {
    entry = {
      failures: [],
      state: "CLOSED",
      openedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      halfOpenInFlight: false,
    };
    circuits.set(key, entry);
  }
  return entry;
}

function pruneFailures(entry: CircuitEntry, at: number) {
  entry.failures = entry.failures.filter((t) => at - t <= FAILURE_WINDOW_MS);
}

function maybeTransitionFromOpen(entry: CircuitEntry, at: number) {
  if (entry.state !== "OPEN" || entry.openedAt == null) return;
  if (at - entry.openedAt >= COOLDOWN_MS) {
    entry.state = "HALF_OPEN";
    entry.halfOpenInFlight = false;
  }
}

export function circuitKey(provider: string, model?: string): string {
  return `${provider}:${model || "*"}`;
}

/** Whether a call may proceed. HALF_OPEN allows one probe at a time. */
export function canAttemptProvider(provider: string, model?: string): boolean {
  const key = circuitKey(provider, model);
  const entry = getOrCreate(key);
  const at = now();
  maybeTransitionFromOpen(entry, at);

  if (entry.state === "CLOSED") return true;
  if (entry.state === "OPEN") return false;
  // HALF_OPEN — single probe
  if (entry.halfOpenInFlight) return false;
  entry.halfOpenInFlight = true;
  return true;
}

export function recordProviderSuccess(provider: string, model?: string) {
  const entry = getOrCreate(circuitKey(provider, model));
  entry.failures = [];
  entry.state = "CLOSED";
  entry.openedAt = null;
  entry.halfOpenInFlight = false;
  entry.lastSuccessAt = now();
}

export function recordProviderTransientFailure(
  provider: string,
  model?: string
) {
  const entry = getOrCreate(circuitKey(provider, model));
  const at = now();
  entry.lastFailureAt = at;
  entry.halfOpenInFlight = false;

  if (entry.state === "HALF_OPEN") {
    entry.state = "OPEN";
    entry.openedAt = at;
    return;
  }

  pruneFailures(entry, at);
  entry.failures.push(at);
  if (entry.failures.length >= FAILURE_THRESHOLD) {
    entry.state = "OPEN";
    entry.openedAt = at;
  }
}

/** Non-transient failures do not trip the breaker (auth, bad params, etc.). */
export function recordProviderNonTransientFailure(
  provider: string,
  model?: string
) {
  const entry = getOrCreate(circuitKey(provider, model));
  entry.lastFailureAt = now();
  entry.halfOpenInFlight = false;
  // Leave state as-is for HALF_OPEN probe failure that isn't transient —
  // still reopen to avoid hammering a bad config.
  if (entry.state === "HALF_OPEN") {
    entry.state = "OPEN";
    entry.openedAt = now();
  }
}

export function getCircuitSnapshot(
  provider: string,
  model?: string
): CircuitSnapshot {
  const key = circuitKey(provider, model);
  const entry = getOrCreate(key);
  maybeTransitionFromOpen(entry, now());
  pruneFailures(entry, now());
  return {
    key,
    state: entry.state,
    failureCount: entry.failures.length,
    lastSuccessAt: entry.lastSuccessAt,
    lastFailureAt: entry.lastFailureAt,
    openedAt: entry.openedAt,
  };
}

/** Test helper — clear all circuits between Vitest cases. */
export function __resetCircuitBreakersForTests() {
  circuits.clear();
}
