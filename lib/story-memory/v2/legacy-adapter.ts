/**
 * Project Memory v2 ↔ legacy StoryMemory for Phase C compatibility.
 */

import type { MemoryPatch, StoryMemory } from "@/lib/story-agent/schema";
import type { MemoryV2Patch } from "@/lib/story-memory/v2/patch";
import {
  normalizeName,
  stableId,
} from "@/lib/story-memory/v2/normalize";
import type { StoryMemoryV2 } from "@/lib/story-memory/v2/schema";
import { upgradeStoryMemory } from "@/lib/story-memory/v2/upgrade";

function charName(memory: StoryMemoryV2, id: string): string {
  return memory.characters.find((c) => c.id === id)?.name || id;
}

/**
 * Project v2 → legacy StoryMemory shape used by runStoryOperation / UI.
 */
export function toLegacyStoryMemory(v2: StoryMemoryV2): StoryMemory {
  const activeRels = v2.relationships.filter(
    (r) => r.status !== "superseded" && r.status !== "corrected"
  );

  const storyStatus =
    v2.story.status === "created"
      ? "created"
      : v2.story.status === "ready" || v2.story.status === "ready_to_write"
        ? "ready"
        : "brainstorming";

  return {
    storyMemory: {
      concept: v2.story.concept ?? undefined,
      title: v2.story.title ?? undefined,
      genre: v2.story.genre ?? [],
      language: v2.story.language ?? undefined,
      tone: v2.story.tone ?? [],
      setting: v2.story.setting ?? undefined,
      plot: v2.story.plot ?? undefined,
      themes: v2.story.themes ?? [],
      pov: v2.story.pov ?? undefined,
      pacing: v2.story.pacing ?? undefined,
      writingStyle: v2.story.writingStyle ?? undefined,
      storyStatus,
    },
    characters: v2.characters.map((c) => ({
      tempId: c.id,
      name: c.name,
      role: c.role ?? undefined,
      age: c.age ?? null,
      personality: c.personalityTraits ?? [],
      background: c.backstory ?? undefined,
      goals: c.goals ?? [],
      conflicts: c.fears ?? [],
      notes: c.notes ?? [],
      avoid: c.avoid ?? [],
    })),
    relationships: activeRels.map((r) => ({
      from: charName(v2, r.fromCharacterId),
      to: charName(v2, r.toCharacterId),
      type: r.type,
      notes: r.notes[0] ?? r.label ?? undefined,
    })),
    writingRules: v2.writingRules
      .filter((r) => r.active)
      .map((r) => ({
        rule: r.rule,
        priority:
          r.priority === "critical" || r.priority === "important"
            ? r.priority
            : r.priority === "high"
              ? ("important" as const)
              : ("normal" as const),
      })),
    userPreferences: {
      dialogueLanguage:
        v2.userPreferences.dialogueLanguage ??
        v2.userPreferences.language ??
        undefined,
      narrationLanguage:
        v2.userPreferences.narrationLanguage ??
        v2.userPreferences.storyLanguage ??
        undefined,
      scriptPreference: v2.userPreferences.scriptPreference ?? undefined,
      mirrorUserLanguage: v2.userPreferences.mirrorUserLanguage ?? true,
      format: v2.userPreferences.format ?? undefined,
      episodeLength: v2.userPreferences.episodeLength ?? undefined,
      uppercaseForLoudDialogue:
        v2.userPreferences.uppercaseForLoudDialogue ?? false,
      slowBurn: v2.userPreferences.slowBurn ?? false,
      doNotStartYet: v2.userPreferences.doNotStartYet ?? false,
      formality: v2.userPreferences.formality ?? undefined,
      dialogueStyle: v2.userPreferences.dialogueStyle ?? undefined,
      narrationStyle: v2.userPreferences.narrationStyle ?? undefined,
      emojiStyle:
        v2.userPreferences.emojiStyle ??
        v2.userPreferences.emojiLevel ??
        undefined,
      avoidFormalHindi: v2.userPreferences.avoidFormalHindi ?? true,
      preferShortDialogues: v2.userPreferences.preferShortDialogues ?? false,
      pacingHint:
        v2.userPreferences.pacingHint ??
        v2.userPreferences.pacing ??
        undefined,
      avoid: v2.userPreferences.avoid ?? [],
    },
    latestDraft: v2.latestDraft ?? null,
    updatedAt: v2.updatedAt ?? undefined,
  };
}

/**
 * Convert legacy MemoryPatch → MemoryV2Patch.
 */
export function legacyPatchToMemoryV2Patch(
  legacy: MemoryPatch | unknown,
  currentV2?: StoryMemoryV2
): MemoryV2Patch {
  const patch = (legacy || {}) as MemoryPatch;
  const v2: MemoryV2Patch = {
    set: {},
    upsertCharacters: [],
    upsertRelationships: [],
    upsertLocations: [],
    upsertObjects: [],
    upsertEvents: [],
    upsertTimeline: [],
    upsertOpenThreads: [],
    upsertSecrets: [],
    upsertPromises: [],
    upsertWorldRules: [],
    upsertWritingRules: [],
    updatePreferences: {},
    updateContinuity: {},
    remove: [],
    corrections: [],
    allowConflicts: false,
  };

  if (patch.story) {
    const s = patch.story;
    v2.set = {
      title: s.title,
      concept: s.concept,
      genre: s.genre,
      tone: s.tone,
      themes: s.themes,
      setting: s.setting,
      plot: s.plot,
      language: s.language,
      pov: s.pov,
      pacing: s.pacing,
      writingStyle: s.writingStyle,
      status: s.storyStatus,
    };
  }

  for (const c of patch.characters || []) {
    v2.upsertCharacters.push({
      id: c.tempId || (c.name ? stableId("char", c.name) : undefined),
      name: c.name,
      role: c.role,
      age: c.age,
      personalityTraits: c.personality,
      backstory: c.background,
      goals: c.goals,
      fears: c.conflicts,
      notes: c.notes,
      avoid: c.avoid,
    });
  }

  for (const r of patch.relationships || []) {
    v2.upsertRelationships.push({
      fromName: r.from,
      toName: r.to,
      type: r.type,
      notes: r.notes ? [r.notes] : [],
      label: r.type,
    });
  }

  for (const rule of patch.writingRules || []) {
    v2.upsertWritingRules.push({
      rule: rule.rule,
      priority:
        rule.priority === "critical"
          ? "critical"
          : rule.priority === "important"
            ? "important"
            : "normal",
      source: "user",
      active: true,
    });
  }

  if (patch.preferences) {
    v2.updatePreferences = {
      ...patch.preferences,
      language: patch.preferences.dialogueLanguage,
      responseLanguage: patch.preferences.dialogueLanguage,
      storyLanguage: patch.preferences.narrationLanguage,
      emojiLevel: patch.preferences.emojiStyle,
      pacing: patch.preferences.pacingHint,
    };
  }

  for (const rem of patch.remove || []) {
    if (rem.type === "character") {
      v2.remove.push({ type: "character", name: rem.name });
    } else if (rem.type === "relationship") {
      // Convert remove+add pattern into correction when possible
      if (rem.from && rem.to) {
        v2.corrections.push({
          entityType: "relationship",
          target: { from: rem.from, to: rem.to },
          incorrectValue: undefined,
          correctValue: undefined,
          reason: "legacy_remove",
        });
      }
      v2.remove.push({
        type: "relationship",
        from: rem.from,
        to: rem.to,
      });
    } else if (rem.type === "rule") {
      v2.remove.push({ type: "writing_rule", rule: rem.rule });
    } else if (rem.type === "preference_key") {
      v2.remove.push({ type: "preference_key", key: rem.key });
    }
  }

  // Detect correction pattern: remove relationship + add new type for same pair
  if (
    (patch.remove || []).some((r) => r.type === "relationship") &&
    (patch.relationships || []).length > 0
  ) {
    const rem = (patch.remove || []).find((r) => r.type === "relationship");
    const add = (patch.relationships || [])[0];
    if (rem?.from && rem?.to && add) {
      v2.allowConflicts = true;
      v2.corrections = [
        {
          entityType: "relationship",
          target: { from: rem.from, to: rem.to },
          incorrectValue: undefined,
          correctValue: add.type,
          reason: "legacy_relationship_replace",
        },
      ];
      // Prefer corrections path over blind remove
      v2.remove = v2.remove.filter((r) => r.type !== "relationship");
      v2.upsertRelationships = [];
    }
  }

  void currentV2;
  return v2;
}

/**
 * Persistable state blob: v2 fields + legacy mirrors for old readers.
 */
export function memoryV2ToPersistedState(
  v2: StoryMemoryV2,
  extras?: Record<string, unknown>
): Record<string, unknown> {
  const legacy = toLegacyStoryMemory(v2);
  return {
    ...extras,
    memoryVersion: 2,
    story: v2.story,
    characters: v2.characters,
    relationships: v2.relationships,
    locations: v2.locations,
    objects: v2.objects,
    events: v2.events,
    timeline: v2.timeline,
    openThreads: v2.openThreads,
    secrets: v2.secrets,
    promises: v2.promises,
    worldRules: v2.worldRules,
    writingRules: v2.writingRules,
    userPreferences: {
      ...legacy.userPreferences,
      ...v2.userPreferences,
    },
    continuity: v2.continuity,
    latestDraft: v2.latestDraft,
    recentSummary: v2.recentSummary,
    metadata: v2.metadata,
    updatedAt: v2.updatedAt,
    // Legacy mirrors
    storyMemory: legacy.storyMemory,
  };
}

/**
 * Load any state → upgraded v2.
 */
export function loadMemoryV2FromState(state: unknown): StoryMemoryV2 {
  return upgradeStoryMemory(state);
}

export function findLegacyCharacterNameMatch(
  memory: StoryMemoryV2,
  name: string
): boolean {
  const key = normalizeName(name);
  return memory.characters.some(
    (c) =>
      normalizeName(c.name) === key ||
      c.aliases.some((a) => normalizeName(a) === key)
  );
}
