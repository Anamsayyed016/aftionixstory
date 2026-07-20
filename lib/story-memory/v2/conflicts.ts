/**
 * Conflict detection for Memory v2 scalar field updates.
 */

import { nowIso } from "@/lib/story-memory/v2/defaults";
import { newEntityId } from "@/lib/story-memory/v2/normalize";
import type { MemoryConflict, StoryMemoryV2 } from "@/lib/story-memory/v2/schema";

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "string") {
    return String(a) === b.trim();
  }
  if (typeof b === "number" && typeof a === "string") {
    return String(b) === a.trim();
  }
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export function recordConflict(
  memory: StoryMemoryV2,
  params: {
    entityType: string;
    entityId: string | null;
    field: string;
    existingValue: unknown;
    incomingValue: unknown;
    reason?: string | null;
  }
): StoryMemoryV2 {
  if (valuesEqual(params.existingValue, params.incomingValue)) {
    return memory;
  }
  if (params.existingValue == null || params.existingValue === "") {
    return memory;
  }

  const conflict: MemoryConflict = {
    id: newEntityId("conflict"),
    entityType: params.entityType,
    entityId: params.entityId,
    field: params.field,
    existingValue: params.existingValue,
    incomingValue: params.incomingValue,
    status: "unresolved",
    createdAt: nowIso(),
    reason: params.reason ?? null,
  };

  return {
    ...memory,
    metadata: {
      ...memory.metadata,
      memoryConflicts: [...memory.metadata.memoryConflicts, conflict],
    },
  };
}

export function resolveConflictOverwrite(
  memory: StoryMemoryV2,
  entityId: string,
  field: string
): StoryMemoryV2 {
  return {
    ...memory,
    metadata: {
      ...memory.metadata,
      memoryConflicts: memory.metadata.memoryConflicts.map((c) =>
        c.entityId === entityId && c.field === field && c.status === "unresolved"
          ? { ...c, status: "corrected" as const }
          : c
      ),
    },
  };
}

export { valuesEqual };
