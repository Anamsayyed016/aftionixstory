/**
 * Safe deterministic merge for Memory v2 patches.
 */

import { recordConflict, valuesEqual } from "@/lib/story-memory/v2/conflicts";
import { applyCorrection } from "@/lib/story-memory/v2/corrections";
import { nowIso } from "@/lib/story-memory/v2/defaults";
import {
  dedupeStrings,
  normalizeKey,
  normalizeLocationKey,
  normalizeName,
  normalizeRuleText,
  stableId,
} from "@/lib/story-memory/v2/normalize";
import {
  memoryV2PatchSchema,
  type MemoryV2Patch,
} from "@/lib/story-memory/v2/patch";
import {
  MEMORY_SOFT_CAPS,
  storyMemoryV2Schema,
  type CharacterV2,
  type StoryMemoryV2,
} from "@/lib/story-memory/v2/schema";

export type ApplyPatchResult = {
  memory: StoryMemoryV2;
  stale: boolean;
  warnings: string[];
  needsClarification: boolean;
};

function mergeLists(
  existing: string[],
  incoming: string[] | undefined,
  replace?: boolean
): string[] {
  if (incoming === undefined) return existing;
  if (replace) return dedupeStrings(incoming);
  if (incoming.length === 0) return existing;
  return dedupeStrings([...existing, ...incoming]);
}

function softCapWarn(
  warnings: string[],
  kind: keyof typeof MEMORY_SOFT_CAPS,
  count: number
) {
  const cap = MEMORY_SOFT_CAPS[kind];
  if (count > cap) {
    warnings.push(`soft_cap_${kind}:${count}>${cap}`);
  }
}

function findCharacterIndex(
  characters: CharacterV2[],
  idOrName?: string | null
): number {
  if (!idOrName) return -1;
  const byId = characters.findIndex((c) => c.id === idOrName);
  if (byId >= 0) return byId;
  const key = normalizeName(idOrName);
  return characters.findIndex(
    (c) =>
      normalizeName(c.name) === key ||
      c.aliases.some((a) => normalizeName(a) === key)
  );
}

function resolveCharacterId(
  memory: StoryMemoryV2,
  id?: string,
  name?: string
): string | null {
  if (id) {
    const idx = findCharacterIndex(memory.characters, id);
    if (idx >= 0) return memory.characters[idx].id;
  }
  if (name) {
    const idx = findCharacterIndex(memory.characters, name);
    if (idx >= 0) return memory.characters[idx].id;
  }
  return null;
}

function upsertCharacter(
  memory: StoryMemoryV2,
  incoming: MemoryV2Patch["upsertCharacters"][number],
  allowConflicts: boolean,
  warnings: string[]
): StoryMemoryV2 {
  if (!incoming.name && !incoming.id) {
    warnings.push("skipped_character_without_name");
    return memory;
  }

  const now = nowIso();
  const idx = findCharacterIndex(
    memory.characters,
    incoming.id || incoming.name
  );

  if (idx < 0) {
    const name = incoming.name || "Unknown";
    const id = incoming.id || stableId("char", name);
    const created: CharacterV2 = {
      id,
      name,
      aliases: dedupeStrings(incoming.aliases ?? []),
      role: incoming.role ?? null,
      gender: incoming.gender ?? null,
      age: incoming.age ?? null,
      occupation: incoming.occupation ?? null,
      personalityTraits: dedupeStrings(incoming.personalityTraits ?? []),
      appearance: dedupeStrings(incoming.appearance ?? []),
      goals: dedupeStrings(incoming.goals ?? []),
      fears: dedupeStrings(incoming.fears ?? []),
      strengths: dedupeStrings(incoming.strengths ?? []),
      weaknesses: dedupeStrings(incoming.weaknesses ?? []),
      backstory: incoming.backstory ?? null,
      currentState: incoming.currentState ?? null,
      status: incoming.status ?? "active",
      notes: dedupeStrings(incoming.notes ?? []),
      avoid: dedupeStrings(incoming.avoid ?? []),
      createdAt: now,
      updatedAt: now,
    };
    return {
      ...memory,
      characters: [...memory.characters, created],
    };
  }

  const existing = memory.characters[idx];
  let nextMemory = memory;

  // Age conflict (and similar scalars) when not allowing overwrite
  if (
    incoming.age != null &&
    existing.age != null &&
    !valuesEqual(existing.age, incoming.age)
  ) {
    if (allowConflicts) {
      nextMemory = {
        ...nextMemory,
        metadata: {
          ...nextMemory.metadata,
          correctionHistory: [
            ...nextMemory.metadata.correctionHistory,
            {
              id: stableId("corr", `${existing.id}_age`),
              entityType: "character",
              target: { name: existing.name, field: "age" },
              incorrectValue: existing.age,
              correctValue: incoming.age,
              reason: "allowConflicts patch",
              appliedAt: now,
              supersededEntityId: null,
              newEntityId: existing.id,
            },
          ],
        },
      };
    } else {
      nextMemory = recordConflict(nextMemory, {
        entityType: "character",
        entityId: existing.id,
        field: "age",
        existingValue: existing.age,
        incomingValue: incoming.age,
      });
    }
  }

  const merged: CharacterV2 = {
    ...existing,
    name: incoming.name || existing.name,
    aliases: mergeLists(
      existing.aliases,
      incoming.aliases,
      incoming.replaceAliases
    ),
    role:
      incoming.role === undefined
        ? existing.role
        : incoming.role || existing.role,
    gender:
      incoming.gender === undefined
        ? existing.gender
        : incoming.gender || existing.gender,
    age:
      incoming.age === undefined
        ? existing.age
        : allowConflicts || existing.age == null
          ? incoming.age
          : existing.age,
    occupation:
      incoming.occupation === undefined
        ? existing.occupation
        : incoming.occupation || existing.occupation,
    personalityTraits: mergeLists(
      existing.personalityTraits,
      incoming.personalityTraits,
      incoming.replaceTraits
    ),
    appearance: mergeLists(existing.appearance, incoming.appearance),
    goals: mergeLists(existing.goals, incoming.goals, incoming.replaceGoals),
    fears: mergeLists(existing.fears, incoming.fears),
    strengths: mergeLists(existing.strengths, incoming.strengths),
    weaknesses: mergeLists(existing.weaknesses, incoming.weaknesses),
    backstory:
      incoming.backstory === undefined
        ? existing.backstory
        : incoming.backstory || existing.backstory,
    currentState:
      incoming.currentState === undefined
        ? existing.currentState
        : incoming.currentState || existing.currentState,
    status: incoming.status ?? existing.status,
    notes: mergeLists(existing.notes, incoming.notes, incoming.replaceNotes),
    avoid: mergeLists(existing.avoid ?? [], incoming.avoid),
    updatedAt: now,
  };

  const characters = [...nextMemory.characters];
  characters[idx] = merged;
  return { ...nextMemory, characters };
}

/**
 * Apply a validated MemoryV2Patch. Idempotent for identical upserts.
 */
export function applyMemoryV2Patch(
  current: StoryMemoryV2,
  rawPatch: unknown,
  opts?: { allowConflicts?: boolean }
): ApplyPatchResult {
  const warnings: string[] = [...(current.metadata.warnings || [])];
  const parsed = memoryV2PatchSchema.safeParse(rawPatch ?? {});
  if (!parsed.success) {
    warnings.push("invalid_patch_rejected");
    return {
      memory: current,
      stale: false,
      warnings,
      needsClarification: false,
    };
  }

  const patch = parsed.data;
  const allowConflicts = Boolean(opts?.allowConflicts || patch.allowConflicts);

  if (
    patch.expectedRevision != null &&
    patch.expectedRevision !== current.metadata.revision
  ) {
    return {
      memory: current,
      stale: true,
      warnings: [...warnings, "stale_revision"],
      needsClarification: false,
    };
  }

  let memory: StoryMemoryV2 = {
    ...current,
    metadata: {
      ...current.metadata,
      memoryConflicts: current.metadata?.memoryConflicts ?? [],
      correctionHistory: current.metadata?.correctionHistory ?? [],
      warnings: current.metadata?.warnings ?? [],
      revision: current.metadata?.revision ?? 0,
    },
  };
  let needsClarification = false;
  const now = nowIso();

  // Removals
  for (const removal of patch.remove) {
    if (removal.type === "character") {
      const idx = findCharacterIndex(
        memory.characters,
        removal.id || removal.name
      );
      if (idx >= 0) {
        const id = memory.characters[idx].id;
        memory = {
          ...memory,
          characters: memory.characters.filter((_, i) => i !== idx),
          relationships: memory.relationships.filter(
            (r) => r.fromCharacterId !== id && r.toCharacterId !== id
          ),
        };
      }
    }
    if (removal.type === "relationship") {
      memory = {
        ...memory,
        relationships: memory.relationships.filter((r) => {
          if (removal.id) return r.id !== removal.id;
          return true;
        }),
      };
    }
    if (removal.type === "writing_rule" && removal.rule) {
      const key = normalizeRuleText(removal.rule);
      memory = {
        ...memory,
        writingRules: memory.writingRules.filter(
          (r) => normalizeRuleText(r.rule) !== key
        ),
      };
    }
    if (removal.type === "preference_key" && removal.key) {
      const prefs = { ...memory.userPreferences } as Record<string, unknown>;
      delete prefs[removal.key];
      memory = {
        ...memory,
        userPreferences: prefs as StoryMemoryV2["userPreferences"],
      };
    }
    if (removal.type === "open_thread" && (removal.id || removal.name)) {
      memory = {
        ...memory,
        openThreads: memory.openThreads.filter(
          (t) =>
            t.id !== removal.id &&
            normalizeName(t.title) !== normalizeName(removal.name || "")
        ),
      };
    }
  }

  // Story set
  if (patch.set && Object.keys(patch.set).length > 0) {
    const story = { ...memory.story };
    for (const [key, value] of Object.entries(patch.set)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      (story as Record<string, unknown>)[key] = value;
    }
    memory = { ...memory, story };
  }

  // Characters
  for (const c of patch.upsertCharacters) {
    memory = upsertCharacter(memory, c, allowConflicts, warnings);
  }

  // Relationships
  for (const rel of patch.upsertRelationships) {
    let fromId =
      resolveCharacterId(memory, rel.fromCharacterId, rel.fromName) ||
      rel.fromCharacterId;
    let toId =
      resolveCharacterId(memory, rel.toCharacterId, rel.toName) ||
      rel.toCharacterId;

    if (!fromId && rel.fromName) {
      memory = upsertCharacter(
        memory,
        { name: rel.fromName },
        allowConflicts,
        warnings
      );
      fromId = resolveCharacterId(memory, undefined, rel.fromName) || undefined;
    }
    if (!toId && rel.toName) {
      memory = upsertCharacter(
        memory,
        { name: rel.toName },
        allowConflicts,
        warnings
      );
      toId = resolveCharacterId(memory, undefined, rel.toName) || undefined;
    }

    if (!fromId || !toId || !rel.type) {
      warnings.push("skipped_relationship_missing_endpoints");
      continue;
    }

    const id =
      rel.id ||
      stableId("rel", `${fromId}_${toId}_${normalizeKey(rel.type)}`);

    const existingIdx = memory.relationships.findIndex((r) => {
      if (r.id === id) return true;
      const samePair =
        r.fromCharacterId === fromId && r.toCharacterId === toId;
      const reversePair =
        r.mutual &&
        r.fromCharacterId === toId &&
        r.toCharacterId === fromId;
      if (!(samePair || reversePair)) return false;
      return normalizeKey(r.type) === normalizeKey(rel.type || "");
    });

    // Legacy replace: same character pair with a different type supersedes the old link
    if (existingIdx < 0) {
      const relationships = memory.relationships.map((r) => {
        if (r.status === "superseded" || r.status === "corrected") return r;
        const samePair =
          (r.fromCharacterId === fromId && r.toCharacterId === toId) ||
          (r.fromCharacterId === toId && r.toCharacterId === fromId);
        if (!samePair) return r;
        if (normalizeKey(r.type) === normalizeKey(rel.type || "")) return r;
        return {
          ...r,
          status: "superseded" as const,
          history: [
            ...r.history,
            `Superseded by ${rel.type} at ${now}`,
          ],
          updatedAt: now,
        };
      });
      memory = { ...memory, relationships };
    }

    const existingAfter = memory.relationships.findIndex((r) => {
      if (r.id === id) return true;
      if (r.status === "superseded" || r.status === "corrected") return false;
      const samePair =
        r.fromCharacterId === fromId && r.toCharacterId === toId;
      const reversePair =
        r.mutual &&
        r.fromCharacterId === toId &&
        r.toCharacterId === fromId;
      if (!(samePair || reversePair)) return false;
      return normalizeKey(r.type) === normalizeKey(rel.type || "");
    });

    if (existingAfter >= 0) {
      const existing = memory.relationships[existingAfter];
      const relationships = [...memory.relationships];
      relationships[existingAfter] = {
        ...existing,
        type: rel.type || existing.type,
        label: rel.label ?? existing.label,
        status: rel.status ?? existing.status,
        mutual: rel.mutual ?? existing.mutual,
        history: mergeLists(existing.history, rel.history),
        conflicts: mergeLists(existing.conflicts, rel.conflicts),
        secrets: mergeLists(existing.secrets, rel.secrets),
        notes: mergeLists(existing.notes, rel.notes),
        updatedAt: now,
      };
      memory = { ...memory, relationships };
    } else {
      memory = {
        ...memory,
        relationships: [
          ...memory.relationships,
          {
            id,
            fromCharacterId: fromId,
            toCharacterId: toId,
            type: rel.type,
            label: rel.label ?? null,
            status: rel.status ?? "developing",
            mutual: Boolean(rel.mutual),
            history: dedupeStrings(rel.history ?? []),
            conflicts: dedupeStrings(rel.conflicts ?? []),
            secrets: dedupeStrings(rel.secrets ?? []),
            notes: dedupeStrings(rel.notes ?? []),
            supersededById: null,
            correctedFromId: null,
            updatedAt: now,
          },
        ],
      };
    }
  }

  // Locations
  for (const loc of patch.upsertLocations) {
    if (!loc.name && !loc.id) continue;
    const name = loc.name || "Unknown";
    const id = loc.id || stableId("loc", normalizeLocationKey(name));
    const idx = memory.locations.findIndex(
      (l) =>
        l.id === id ||
        normalizeLocationKey(l.name) === normalizeLocationKey(name)
    );
    if (idx >= 0) {
      const locations = [...memory.locations];
      locations[idx] = {
        ...locations[idx],
        ...Object.fromEntries(
          Object.entries(loc).filter(
            ([, v]) =>
              v !== undefined &&
              !(typeof v === "string" && v.trim() === "") &&
              !(Array.isArray(v) && v.length === 0)
          )
        ),
        id: locations[idx].id,
        name: loc.name || locations[idx].name,
      } as (typeof locations)[number];
      memory = { ...memory, locations };
    } else {
      memory = {
        ...memory,
        locations: [
          ...memory.locations,
          {
            id,
            name,
            type: loc.type ?? null,
            description: loc.description ?? null,
            mood: loc.mood ?? null,
            importance: loc.importance ?? "secondary",
            rules: dedupeStrings(loc.rules ?? []),
            relatedCharacterIds: loc.relatedCharacterIds ?? [],
            notes: dedupeStrings(loc.notes ?? []),
          },
        ],
      };
    }
  }

  // Objects / events / timeline / threads / secrets / promises / world rules — similar upsert-by-id-or-key
  for (const obj of patch.upsertObjects) {
    if (!obj.name && !obj.id) continue;
    const name = obj.name || "Unknown";
    const id = obj.id || stableId("obj", name);
    const idx = memory.objects.findIndex(
      (o) => o.id === id || normalizeName(o.name) === normalizeName(name)
    );
    if (idx >= 0) {
      const objects = [...memory.objects];
      objects[idx] = {
        ...objects[idx],
        ...obj,
        id: objects[idx].id,
        name: obj.name || objects[idx].name,
        history: mergeLists(objects[idx].history, obj.history),
      } as (typeof objects)[number];
      memory = { ...memory, objects };
    } else {
      memory = {
        ...memory,
        objects: [
          ...memory.objects,
          {
            id,
            name,
            type: obj.type ?? null,
            description: obj.description ?? null,
            ownerCharacterId: obj.ownerCharacterId ?? null,
            locationId: obj.locationId ?? null,
            importance: obj.importance ?? "important",
            status: obj.status ?? "active",
            history: dedupeStrings(obj.history ?? []),
          },
        ],
      };
    }
  }

  for (const ev of patch.upsertEvents) {
    if (!ev.title && !ev.id) continue;
    const title = ev.title || "Untitled";
    const id = ev.id || stableId("evt", title);
    const idx = memory.events.findIndex(
      (e) => e.id === id || normalizeName(e.title) === normalizeName(title)
    );
    if (idx >= 0) {
      const events = [...memory.events];
      events[idx] = {
        ...events[idx],
        ...ev,
        id: events[idx].id,
        title: ev.title || events[idx].title,
      } as (typeof events)[number];
      memory = { ...memory, events };
    } else {
      memory = {
        ...memory,
        events: [
          ...memory.events,
          {
            id,
            title,
            description: ev.description ?? null,
            type: ev.type ?? null,
            episodeNumber: ev.episodeNumber ?? null,
            sceneId: ev.sceneId ?? null,
            characterIds: ev.characterIds ?? [],
            locationId: ev.locationId ?? null,
            order: ev.order ?? null,
            importance: ev.importance ?? "major",
            resolved: Boolean(ev.resolved),
            causes: dedupeStrings(ev.causes ?? []),
            consequences: dedupeStrings(ev.consequences ?? []),
          },
        ],
      };
    }
  }

  for (const tl of patch.upsertTimeline) {
    if (!tl.label && !tl.id) continue;
    const label = tl.label || "Untitled";
    const id = tl.id || stableId("tl", `${tl.sequence ?? 0}_${label}`);
    const idx = memory.timeline.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const timeline = [...memory.timeline];
      timeline[idx] = {
        ...timeline[idx],
        ...tl,
        id: timeline[idx].id,
        label: tl.label || timeline[idx].label,
      } as (typeof timeline)[number];
      memory = { ...memory, timeline };
    } else {
      memory = {
        ...memory,
        timeline: [
          ...memory.timeline,
          {
            id,
            label,
            sequence: tl.sequence ?? memory.timeline.length + 1,
            absoluteDate: tl.absoluteDate ?? null,
            relativeTime: tl.relativeTime ?? null,
            eventIds: tl.eventIds ?? [],
            notes: dedupeStrings(tl.notes ?? []),
          },
        ],
      };
    }
  }

  for (const thread of patch.upsertOpenThreads) {
    if (!thread.title && !thread.id) continue;
    const title = thread.title || "Untitled";
    const id = thread.id || stableId("thread", title);
    const idx = memory.openThreads.findIndex(
      (t) => t.id === id || normalizeName(t.title) === normalizeName(title)
    );
    if (idx >= 0) {
      const openThreads = [...memory.openThreads];
      openThreads[idx] = {
        ...openThreads[idx],
        ...thread,
        id: openThreads[idx].id,
        title: thread.title || openThreads[idx].title,
      } as (typeof openThreads)[number];
      memory = { ...memory, openThreads };
    } else {
      memory = {
        ...memory,
        openThreads: [
          ...memory.openThreads,
          {
            id,
            title,
            description: thread.description ?? null,
            status: thread.status ?? "open",
            priority: thread.priority ?? "medium",
            introducedAtEpisode: thread.introducedAtEpisode ?? null,
            relatedCharacterIds: thread.relatedCharacterIds ?? [],
            relatedEventIds: thread.relatedEventIds ?? [],
            possibleResolutions: dedupeStrings(thread.possibleResolutions ?? []),
            resolvedAtEpisode: thread.resolvedAtEpisode ?? null,
          },
        ],
      };
    }
  }

  for (const secret of patch.upsertSecrets) {
    if (!secret.title && !secret.id) continue;
    const title = secret.title || "Untitled";
    const id = secret.id || stableId("secret", title);
    const knownBy = (secret.knownByCharacterIds ?? []).map(
      (x) => resolveCharacterId(memory, x, x) || x
    );
    const hiddenFrom = (secret.hiddenFromCharacterIds ?? []).map(
      (x) => resolveCharacterId(memory, x, x) || x
    );
    const idx = memory.secrets.findIndex(
      (s) => s.id === id || normalizeName(s.title) === normalizeName(title)
    );
    if (idx >= 0) {
      const secrets = [...memory.secrets];
      secrets[idx] = {
        ...secrets[idx],
        ...secret,
        id: secrets[idx].id,
        title: secret.title || secrets[idx].title,
        knownByCharacterIds: knownBy.length
          ? knownBy
          : secrets[idx].knownByCharacterIds,
        hiddenFromCharacterIds: hiddenFrom.length
          ? hiddenFrom
          : secrets[idx].hiddenFromCharacterIds,
      } as (typeof secrets)[number];
      memory = { ...memory, secrets };
    } else {
      memory = {
        ...memory,
        secrets: [
          ...memory.secrets,
          {
            id,
            title,
            description: secret.description ?? null,
            knownByCharacterIds: knownBy,
            hiddenFromCharacterIds: hiddenFrom,
            revealed: Boolean(secret.revealed),
            revealedAtEpisode: secret.revealedAtEpisode ?? null,
            importance: secret.importance ?? "major",
          },
        ],
      };
    }
  }

  for (const promise of patch.upsertPromises) {
    if (!promise.text && !promise.id) continue;
    const text = promise.text || "Untitled promise";
    const id = promise.id || stableId("promise", text);
    const idx = memory.promises.findIndex(
      (p) => p.id === id || normalizeName(p.text) === normalizeName(text)
    );
    if (idx >= 0) {
      const promises = [...memory.promises];
      const prev = promises[idx];
      promises[idx] = {
        ...prev,
        ...promise,
        id: prev.id,
        text: promise.text || prev.text,
        history: mergeLists(prev.history, [
          ...(promise.status && promise.status !== prev.status
            ? [`Status ${prev.status} → ${promise.status} at ${now}`]
            : []),
          ...(promise.history ?? []),
        ]),
      } as (typeof promises)[number];
      memory = { ...memory, promises };
    } else {
      memory = {
        ...memory,
        promises: [
          ...memory.promises,
          {
            id,
            text,
            madeByCharacterId:
              resolveCharacterId(
                memory,
                promise.madeByCharacterId ?? undefined,
                promise.madeByCharacterId ?? undefined
              ) ?? null,
            madeToCharacterId:
              resolveCharacterId(
                memory,
                promise.madeToCharacterId ?? undefined,
                promise.madeToCharacterId ?? undefined
              ) ?? null,
            episodeNumber: promise.episodeNumber ?? null,
            status: promise.status ?? "active",
            fulfilledAtEpisode: promise.fulfilledAtEpisode ?? null,
            brokenAtEpisode: promise.brokenAtEpisode ?? null,
            history: dedupeStrings(promise.history ?? []),
          },
        ],
      };
    }
  }

  for (const rule of patch.upsertWorldRules) {
    if (!rule.rule && !rule.id) continue;
    const text = rule.rule || "";
    const id = rule.id || stableId("wrule", text);
    const idx = memory.worldRules.findIndex(
      (r) => r.id === id || normalizeRuleText(r.rule) === normalizeRuleText(text)
    );
    if (idx >= 0) {
      const worldRules = [...memory.worldRules];
      worldRules[idx] = {
        ...worldRules[idx],
        ...rule,
        id: worldRules[idx].id,
        rule: rule.rule || worldRules[idx].rule,
      } as (typeof worldRules)[number];
      memory = { ...memory, worldRules };
    } else {
      memory = {
        ...memory,
        worldRules: [
          ...memory.worldRules,
          {
            id,
            rule: text,
            category: rule.category ?? null,
            strict: rule.strict !== false,
            exceptions: dedupeStrings(rule.exceptions ?? []),
            notes: dedupeStrings(rule.notes ?? []),
          },
        ],
      };
    }
  }

  for (const rule of patch.upsertWritingRules) {
    if (!rule.rule && !rule.id) continue;
    const text = rule.rule || "";
    const norm = normalizeRuleText(text);
    const idx = memory.writingRules.findIndex(
      (r) =>
        (rule.id && r.id === rule.id) ||
        normalizeRuleText(r.rule) === norm
    );
    if (idx >= 0) {
      const writingRules = [...memory.writingRules];
      const existing = writingRules[idx];
      const priority = rule.priority || existing.priority;
      writingRules[idx] = {
        ...existing,
        priority,
        active: rule.active ?? existing.active,
        category: rule.category ?? existing.category,
        updatedAt: now,
      };
      memory = { ...memory, writingRules };
    } else {
      memory = {
        ...memory,
        writingRules: [
          ...memory.writingRules,
          {
            id: rule.id || stableId("wrule", norm),
            rule: text,
            category: rule.category ?? null,
            priority: rule.priority ?? "normal",
            active: rule.active !== false,
            source: rule.source ?? "user",
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    }
  }

  // Preferences — never touch story facts
  if (patch.updatePreferences && Object.keys(patch.updatePreferences).length) {
    const prefs = { ...memory.userPreferences };
    for (const [key, value] of Object.entries(patch.updatePreferences)) {
      if (value === undefined) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      if (Array.isArray(value) && value.length === 0 && key === "avoid") {
        continue;
      }
      if (key === "avoid" && Array.isArray(value)) {
        prefs.avoid = mergeLists(prefs.avoid, value);
        continue;
      }
      (prefs as Record<string, unknown>)[key] = value;
      // Mirror language fields
      if (key === "language" && typeof value === "string") {
        prefs.dialogueLanguage = value;
        prefs.responseLanguage = value;
      }
      if (key === "dialogueLanguage" && typeof value === "string") {
        prefs.language = prefs.language || value;
        prefs.responseLanguage = prefs.responseLanguage || value;
      }
    }
    memory = { ...memory, userPreferences: prefs };
  }

  if (patch.updateContinuity && Object.keys(patch.updateContinuity).length) {
    memory = {
      ...memory,
      continuity: {
        ...memory.continuity,
        ...Object.fromEntries(
          Object.entries(patch.updateContinuity).filter(
            ([, v]) => v !== undefined
          )
        ),
      },
    };
  }

  if (patch.setLatestDraft !== undefined) {
    memory = { ...memory, latestDraft: patch.setLatestDraft };
  }

  // Corrections
  for (const corr of patch.corrections) {
    const result = applyCorrection(memory, corr);
    memory = result.memory;
    if (result.needsClarification) needsClarification = true;
  }

  softCapWarn(warnings, "characters", memory.characters.length);
  softCapWarn(warnings, "relationships", memory.relationships.length);

  memory = {
    ...memory,
    memoryVersion: 2,
    updatedAt: now,
    metadata: {
      ...memory.metadata,
      warnings: dedupeStrings(warnings),
      revision: (memory.metadata.revision || 0) + 1,
    },
  };

  const validated = storyMemoryV2Schema.safeParse(memory);
  return {
    memory: validated.success ? validated.data : memory,
    stale: false,
    warnings,
    needsClarification,
  };
}
