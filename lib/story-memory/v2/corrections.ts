/**
 * Explicit correction application for Memory v2.
 */

import { nowIso } from "@/lib/story-memory/v2/defaults";
import {
  normalizeKey,
  normalizeName,
  newEntityId,
  stableId,
} from "@/lib/story-memory/v2/normalize";
import type { CorrectionPatch } from "@/lib/story-memory/v2/patch";
import type {
  CorrectionRecord,
  RelationshipV2,
  StoryMemoryV2,
} from "@/lib/story-memory/v2/schema";

function findCharacterId(
  memory: StoryMemoryV2,
  nameOrId: string | undefined
): string | null {
  if (!nameOrId) return null;
  const byId = memory.characters.find((c) => c.id === nameOrId);
  if (byId) return byId.id;
  const key = normalizeName(nameOrId);
  const byName = memory.characters.find(
    (c) =>
      normalizeName(c.name) === key ||
      c.aliases.some((a) => normalizeName(a) === key)
  );
  return byName?.id ?? null;
}

function ensureCharacter(
  memory: StoryMemoryV2,
  name: string
): { memory: StoryMemoryV2; id: string } {
  const existing = findCharacterId(memory, name);
  if (existing) return { memory, id: existing };
  const id = stableId("char", name);
  const now = nowIso();
  return {
    memory: {
      ...memory,
      characters: [
        ...memory.characters,
        {
          id,
          name,
          aliases: [],
          role: null,
          gender: null,
          age: null,
          occupation: null,
          personalityTraits: [],
          appearance: [],
          goals: [],
          fears: [],
          strengths: [],
          weaknesses: [],
          backstory: null,
          currentState: null,
          status: "active",
          notes: [],
          avoid: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    id,
  };
}

/**
 * Apply one correction. Marks old relationships as superseded; does not delete history.
 */
export function applyCorrection(
  memory: StoryMemoryV2,
  correction: CorrectionPatch
): { memory: StoryMemoryV2; applied: boolean; needsClarification?: boolean } {
  if (correction.entityType === "relationship") {
    const fromName = String(correction.target.from ?? correction.target.fromName ?? "");
    const toName = String(correction.target.to ?? correction.target.toName ?? "");
    if (!fromName || !toName) {
      return { memory, applied: false, needsClarification: true };
    }

    let next = memory;
    let fromId = findCharacterId(next, fromName);
    let toId = findCharacterId(next, toName);
    if (!fromId) {
      const ensured = ensureCharacter(next, fromName);
      next = ensured.memory;
      fromId = ensured.id;
    }
    if (!toId) {
      const ensured = ensureCharacter(next, toName);
      next = ensured.memory;
      toId = ensured.id;
    }

    const incorrect =
      correction.incorrectValue == null || correction.incorrectValue === ""
        ? ""
        : String(correction.incorrectValue).toLowerCase();
    const correct = String(correction.correctValue ?? "").trim();
    if (!correct) {
      return { memory: next, applied: false, needsClarification: true };
    }

    const now = nowIso();
    const relationships = [...next.relationships];
    const supersededIds: string[] = [];

    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      const pairMatch =
        (rel.fromCharacterId === fromId && rel.toCharacterId === toId) ||
        (rel.fromCharacterId === toId && rel.toCharacterId === fromId);
      if (!pairMatch) continue;
      const typeMatch =
        !incorrect ||
        rel.type.toLowerCase().includes(incorrect) ||
        (rel.label || "").toLowerCase().includes(incorrect);
      if (!typeMatch) continue;
      if (rel.status === "superseded" || rel.status === "corrected") continue;

      relationships[i] = {
        ...rel,
        status: "superseded",
        history: [
          ...rel.history,
          `Corrected: ${rel.type} → ${correct} (${correction.reason || "user"})`,
        ],
        updatedAt: now,
      };
      supersededIds.push(rel.id);
    }

    const newId = stableId("rel", `${fromId}_${toId}_${normalizeKey(correct)}`);
    const existingCorrect = relationships.find(
      (r) =>
        r.id === newId ||
        (r.fromCharacterId === fromId &&
          r.toCharacterId === toId &&
          normalizeKey(r.type) === normalizeKey(correct) &&
          r.status !== "superseded")
    );

    let newEntityIdValue = existingCorrect?.id ?? newId;
    if (existingCorrect) {
      const idx = relationships.findIndex((r) => r.id === existingCorrect.id);
      relationships[idx] = {
        ...existingCorrect,
        status: "active",
        type: correct,
        history: [
          ...existingCorrect.history,
          `Confirmed via correction at ${now}`,
        ],
        correctedFromId: supersededIds[0] ?? existingCorrect.correctedFromId,
        updatedAt: now,
      };
    } else {
      const created: RelationshipV2 = {
        id: newId,
        fromCharacterId: fromId,
        toCharacterId: toId,
        type: correct,
        label: correct,
        status: "active",
        mutual: false,
        history: [
          `Created by correction from ${incorrect || "previous"} at ${now}`,
        ],
        conflicts: [],
        secrets: [],
        notes: [],
        supersededById: null,
        correctedFromId: supersededIds[0] ?? null,
        updatedAt: now,
      };
      relationships.push(created);
      newEntityIdValue = created.id;
    }

    // Link superseded → new
    for (let i = 0; i < relationships.length; i++) {
      if (supersededIds.includes(relationships[i].id)) {
        relationships[i] = {
          ...relationships[i],
          supersededById: newEntityIdValue,
        };
      }
    }

    const record: CorrectionRecord = {
      id: newEntityId("corr"),
      entityType: "relationship",
      target: { from: fromName, to: toName },
      incorrectValue: correction.incorrectValue,
      correctValue: correct,
      reason: correction.reason ?? null,
      appliedAt: now,
      supersededEntityId: supersededIds[0] ?? null,
      newEntityId: newEntityIdValue,
    };

    return {
      memory: {
        ...next,
        relationships,
        metadata: {
          ...next.metadata,
          memoryConflicts: next.metadata.memoryConflicts ?? [],
          warnings: next.metadata.warnings ?? [],
          revision: next.metadata.revision ?? 0,
          correctionHistory: [
            ...(next.metadata.correctionHistory ?? []),
            record,
          ],
        },
        updatedAt: now,
      },
      applied: true,
    };
  }

  if (correction.entityType === "character") {
    const name = String(
      correction.target.name ?? correction.target.character ?? ""
    );
    const field = correction.field || "age";
    if (!name) {
      return { memory, applied: false, needsClarification: true };
    }
    let next = memory;
    let id = findCharacterId(next, name);
    if (!id) {
      const ensured = ensureCharacter(next, name);
      next = ensured.memory;
      id = ensured.id;
    }
    const now = nowIso();
    const characters = next.characters.map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, updatedAt: now } as typeof c & Record<string, unknown>;
      updated[field] = correction.correctValue;
      return updated;
    });

    const record: CorrectionRecord = {
      id: newEntityId("corr"),
      entityType: "character",
      target: { name, field },
      incorrectValue: correction.incorrectValue,
      correctValue: correction.correctValue,
      reason: correction.reason ?? null,
      appliedAt: now,
      supersededEntityId: null,
      newEntityId: id,
    };

    return {
      memory: {
        ...next,
        characters,
        metadata: {
          ...next.metadata,
          memoryConflicts: (next.metadata.memoryConflicts ?? []).map((c) =>
            c.entityId === id && c.field === field
              ? { ...c, status: "corrected" as const }
              : c
          ),
          warnings: next.metadata.warnings ?? [],
          revision: next.metadata.revision ?? 0,
          correctionHistory: [
            ...(next.metadata.correctionHistory ?? []),
            record,
          ],
        },
        updatedAt: now,
      },
      applied: true,
    };
  }

  return { memory, applied: false, needsClarification: true };
}
