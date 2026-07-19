import {
  memoryPatchSchema,
  storyMemorySchema,
  type MemoryPatch,
  type StoryMemory,
  type StoryMemoryCharacter,
  type StoryMemoryRelationship,
} from "@/lib/story-agent/schema";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function mergeStringLists(a: string[] = [], b: string[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [...a, ...b]) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function nonEmptyMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T>
): T {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

export function emptyStoryMemory(): StoryMemory {
  return storyMemorySchema.parse({});
}

export function parseStoryMemory(raw: unknown): StoryMemory {
  const parsed = storyMemorySchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  return emptyStoryMemory();
}

function mergeCharacter(
  existing: StoryMemoryCharacter | undefined,
  incoming: StoryMemoryCharacter
): StoryMemoryCharacter {
  if (!existing) {
    return {
      ...incoming,
      tempId: incoming.tempId || `c_${normalizeName(incoming.name).replace(/\s+/g, "_")}`,
      personality: incoming.personality ?? [],
      goals: incoming.goals ?? [],
      conflicts: incoming.conflicts ?? [],
      notes: incoming.notes ?? [],
      avoid: incoming.avoid ?? [],
    };
  }

  return {
    tempId: existing.tempId || incoming.tempId,
    name: incoming.name || existing.name,
    role: incoming.role || existing.role,
    age: incoming.age ?? existing.age ?? null,
    personality: mergeStringLists(existing.personality, incoming.personality),
    background: incoming.background || existing.background,
    goals: mergeStringLists(existing.goals, incoming.goals),
    conflicts: mergeStringLists(existing.conflicts, incoming.conflicts),
    notes: mergeStringLists(existing.notes, incoming.notes),
    avoid: mergeStringLists(existing.avoid, incoming.avoid),
  };
}

function relationshipKey(rel: StoryMemoryRelationship): string {
  return `${normalizeName(rel.from)}::${normalizeName(rel.to)}::${normalizeName(rel.type)}`;
}

function pairKey(from: string, to: string): string {
  const a = normalizeName(from);
  const b = normalizeName(to);
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function applyMemoryPatch(
  current: StoryMemory,
  rawPatch: unknown
): StoryMemory {
  const patchParsed = memoryPatchSchema.safeParse(rawPatch ?? {});
  const patch: MemoryPatch = patchParsed.success
    ? patchParsed.data
    : memoryPatchSchema.parse({});

  let characters = [...current.characters];
  let relationships = [...current.relationships];
  let writingRules = [...current.writingRules];
  let preferences = { ...current.userPreferences };
  let story = { ...current.storyMemory };

  for (const removal of patch.remove) {
    if (removal.type === "character" && removal.name) {
      const key = normalizeName(removal.name);
      characters = characters.filter((c) => normalizeName(c.name) !== key);
      relationships = relationships.filter(
        (r) => normalizeName(r.from) !== key && normalizeName(r.to) !== key
      );
    }
    if (removal.type === "relationship") {
      relationships = relationships.filter((r) => {
        if (removal.from && removal.to) {
          return pairKey(r.from, r.to) !== pairKey(removal.from, removal.to);
        }
        if (removal.from) return normalizeName(r.from) !== normalizeName(removal.from);
        if (removal.to) return normalizeName(r.to) !== normalizeName(removal.to);
        return true;
      });
    }
    if (removal.type === "rule" && removal.rule) {
      const key = normalizeName(removal.rule);
      writingRules = writingRules.filter((r) => normalizeName(r.rule) !== key);
    }
    if (removal.type === "preference_key" && removal.key) {
      const key = removal.key as keyof typeof preferences;
      if (key in preferences) {
        if (key === "avoid") preferences.avoid = [];
        else if (key === "uppercaseForLoudDialogue" || key === "slowBurn" || key === "doNotStartYet") {
          (preferences as Record<string, unknown>)[key] = false;
        } else {
          (preferences as Record<string, unknown>)[key] = undefined;
        }
      }
    }
  }

  story = nonEmptyMerge(story, patch.story ?? {});

  for (const incoming of patch.characters) {
    if (!incoming.name?.trim()) continue;
    const idx = characters.findIndex(
      (c) => normalizeName(c.name) === normalizeName(incoming.name)
    );
    if (idx >= 0) {
      characters[idx] = mergeCharacter(characters[idx], incoming);
    } else {
      characters.push(mergeCharacter(undefined, incoming));
    }
  }

  for (const incoming of patch.relationships) {
    if (!incoming.from?.trim() || !incoming.to?.trim() || !incoming.type?.trim()) {
      continue;
    }
    // Corrections: same pair, different type → replace
    const samePair = relationships.findIndex(
      (r) => pairKey(r.from, r.to) === pairKey(incoming.from, incoming.to)
    );
    if (samePair >= 0) {
      relationships[samePair] = {
        ...relationships[samePair],
        ...incoming,
        from: incoming.from,
        to: incoming.to,
        type: incoming.type,
        notes: incoming.notes || relationships[samePair].notes,
      };
      continue;
    }
    const exact = relationships.findIndex(
      (r) => relationshipKey(r) === relationshipKey(incoming)
    );
    if (exact >= 0) {
      relationships[exact] = {
        ...relationships[exact],
        notes: incoming.notes || relationships[exact].notes,
      };
    } else {
      relationships.push(incoming);
    }
  }

  for (const incoming of patch.writingRules) {
    if (!incoming.rule?.trim()) continue;
    const idx = writingRules.findIndex(
      (r) => normalizeName(r.rule) === normalizeName(incoming.rule)
    );
    if (idx >= 0) {
      writingRules[idx] = {
        ...writingRules[idx],
        priority: incoming.priority || writingRules[idx].priority,
      };
    } else {
      writingRules.push(incoming);
    }
  }

  preferences = {
    ...preferences,
    ...Object.fromEntries(
      Object.entries(patch.preferences ?? {}).filter(([, v]) => {
        if (v == null) return false;
        if (typeof v === "string" && v.trim() === "") return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      })
    ),
    avoid: mergeStringLists(preferences.avoid, patch.preferences?.avoid ?? []),
  };

  return storyMemorySchema.parse({
    storyMemory: {
      concept: story.concept,
      title: story.title,
      genre: story.genre ?? [],
      language: story.language,
      tone: story.tone ?? [],
      setting: story.setting,
      plot: story.plot,
      themes: story.themes ?? [],
      pov: story.pov,
      pacing: story.pacing,
      writingStyle: story.writingStyle,
      storyStatus: story.storyStatus ?? "brainstorming",
    },
    characters,
    relationships,
    writingRules,
    userPreferences: {
      dialogueLanguage: preferences.dialogueLanguage,
      narrationLanguage: preferences.narrationLanguage,
      scriptPreference: preferences.scriptPreference,
      mirrorUserLanguage: preferences.mirrorUserLanguage ?? true,
      format: preferences.format,
      episodeLength: preferences.episodeLength,
      uppercaseForLoudDialogue: preferences.uppercaseForLoudDialogue ?? false,
      slowBurn: preferences.slowBurn ?? false,
      doNotStartYet: preferences.doNotStartYet ?? false,
      formality: preferences.formality,
      dialogueStyle: preferences.dialogueStyle,
      narrationStyle: preferences.narrationStyle,
      emojiStyle: preferences.emojiStyle,
      avoidFormalHindi: preferences.avoidFormalHindi ?? true,
      preferShortDialogues: preferences.preferShortDialogues ?? false,
      pacingHint: preferences.pacingHint,
      avoid: preferences.avoid ?? [],
    },
    latestDraft: current.latestDraft ?? null,
    updatedAt: new Date().toISOString(),
  });
}

export function describeMemoryStatus(memory: StoryMemory): string {
  const chars = memory.characters.length;
  const status = memory.storyMemory.storyStatus ?? "brainstorming";
  if (status === "created") return "Story created — ready to write episodes";
  if (status === "ready") return "Ready to start when you are";
  if (chars > 0) {
    return `${chars} character${chars === 1 ? "" : "s"} remembered`;
  }
  if (memory.storyMemory.concept || memory.storyMemory.title) {
    return "Building your story world";
  }
  return "Building your story world";
}

/** Map memory into wizard-ish draft for createStoryAction. */
export function memoryToWizardCandidate(memory: StoryMemory): {
  title: string;
  genre: string;
  language: string;
  description?: string;
  tone?: string;
  setting?: string;
  pointOfView?: string;
  pacing?: string;
  writingStyle?: string;
  initialPlot?: string;
  characters: Array<{
    clientId: string;
    name: string;
    role: string;
    personality: string;
    age?: number | null;
    background?: string;
  }>;
  relationships: Array<{
    sourceClientId: string;
    targetClientId: string;
    relationshipType: string;
    description?: string;
  }>;
  writingRules: Array<{
    rule: string;
    priority: number;
    isActive: boolean;
  }>;
} {
  const sm = memory.storyMemory;
  const nameToId = new Map<string, string>();
  const characters = memory.characters.map((c, index) => {
    const clientId = c.tempId || `c${index + 1}`;
    nameToId.set(normalizeName(c.name), clientId);
    const personality = (c.personality ?? []).join(", ");
    const avoid = (c.avoid ?? []).map((a) => `not ${a}`).join("; ");
    return {
      clientId,
      name: c.name,
      role: c.role?.trim() || "Character",
      personality: [personality, avoid].filter(Boolean).join(". ") || "Developing",
      age: typeof c.age === "number" ? c.age : null,
      background: c.background,
    };
  });

  const relationships = memory.relationships
    .map((r) => {
      const sourceClientId = nameToId.get(normalizeName(r.from));
      const targetClientId = nameToId.get(normalizeName(r.to));
      if (!sourceClientId || !targetClientId) return null;
      return {
        sourceClientId,
        targetClientId,
        relationshipType: r.type,
        description: r.notes,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const priorityMap = { normal: 5, important: 7, critical: 9 } as const;

  return {
    title: sm.title?.trim() || sm.concept?.trim().slice(0, 80) || "Untitled Story",
    genre: sm.genre?.[0] || "Drama",
    language: sm.language || "English",
    description: sm.concept,
    tone: sm.tone?.join(", ") || undefined,
    setting: sm.setting,
    pointOfView: sm.pov,
    pacing: sm.pacing,
    writingStyle: sm.writingStyle,
    initialPlot: sm.plot,
    characters,
    relationships,
    writingRules: memory.writingRules.map((r) => ({
      rule: r.rule,
      priority: priorityMap[r.priority ?? "normal"],
      isActive: true,
    })),
  };
}

export function getMissingCreateFields(memory: StoryMemory): string[] {
  const missing: string[] = [];
  const candidate = memoryToWizardCandidate(memory);
  if (!candidate.title || candidate.title.trim().length < 3) missing.push("title");
  if (!candidate.genre || candidate.genre.trim().length < 2) missing.push("genre");
  if (!candidate.language || candidate.language.trim().length < 2) {
    missing.push("language");
  }
  if (candidate.characters.length < 1) missing.push("characters");
  else {
    const weak = candidate.characters.some(
      (c) =>
        !c.name.trim() ||
        !c.role.trim() ||
        c.personality.trim().length < 3
    );
    if (weak) missing.push("character details");
  }
  return missing;
}
