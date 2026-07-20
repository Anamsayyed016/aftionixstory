/**
 * Locked fact helpers (Phase G.5).
 */

import type { ResolvedStoryFacts } from "@/lib/story-fidelity/schemas";

export function lockField(
  facts: ResolvedStoryFacts,
  field: string
): ResolvedStoryFacts {
  const locked = new Set(facts.metadata.lockedFields);
  locked.add(field);
  return {
    ...facts,
    metadata: {
      ...facts.metadata,
      lockedFields: [...locked],
      updatedAt: new Date().toISOString(),
      confirmedAt: facts.metadata.confirmedAt || new Date().toISOString(),
    },
  };
}

export function isFieldLocked(
  facts: ResolvedStoryFacts,
  field: string
): boolean {
  return facts.metadata.lockedFields.includes(field);
}

/**
 * Apply a value: locked fields only change on explicitCorrection.
 */
export function setLockedAwareField<T>(params: {
  facts: ResolvedStoryFacts;
  field: string;
  value: T;
  get: (f: ResolvedStoryFacts) => T;
  set: (f: ResolvedStoryFacts, value: T) => ResolvedStoryFacts;
  explicitCorrection?: boolean;
  lock?: boolean;
}): ResolvedStoryFacts {
  const current = params.get(params.facts);
  const locked = isFieldLocked(params.facts, params.field);
  if (locked && !params.explicitCorrection) {
    // keep locked value
    if (current != null && current !== "" && !(Array.isArray(current) && current.length === 0)) {
      return params.facts;
    }
  }
  let next = params.set(params.facts, params.value);
  if (params.lock) {
    next = lockField(next, params.field);
  }
  return next;
}
