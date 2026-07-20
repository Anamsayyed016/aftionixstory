/**
 * Memory patch helpers — Phase C routes through Memory Model v2.
 * Public API remains legacy StoryMemory for runStoryOperation compatibility.
 */

import {
  memoryPatchSchema,
  storyMemorySchema,
  type MemoryPatch,
  type StoryMemory,
  type StoryMemoryCharacter,
} from "@/lib/story-agent/schema";
import {
  applyMemoryV2Patch,
  legacyPatchToMemoryV2Patch,
  toLegacyStoryMemory,
  upgradeStoryMemory,
  type StoryMemoryV2,
} from "@/lib/story-memory/v2";
import { emptyStoryMemoryV2 } from "@/lib/story-memory/v2/defaults";

export type StoryMemoryWithV2 = StoryMemory & {
  memoryVersion?: number;
  __memoryV2?: StoryMemoryV2;
};

function extractV2(current: StoryMemory | null | undefined): StoryMemoryV2 {
  if (!current) return emptyStoryMemoryV2();
  const withV2 = current as StoryMemoryWithV2;

  // Re-upgrade from the legacy surface so direct test/runtime mutations to
  // characters/relationships/storyMemory are not masked by a stale __memoryV2.
  const surface: Record<string, unknown> = {
    memoryVersion: 2,
    storyMemory: current.storyMemory,
    characters: current.characters,
    relationships: current.relationships,
    writingRules: current.writingRules,
    userPreferences: current.userPreferences,
    latestDraft: current.latestDraft,
    updatedAt: current.updatedAt,
  };

  if (withV2.__memoryV2) {
    const v2 = withV2.__memoryV2;
    surface.locations = v2.locations;
    surface.objects = v2.objects;
    surface.events = v2.events;
    surface.timeline = v2.timeline;
    surface.openThreads = v2.openThreads;
    surface.secrets = v2.secrets;
    surface.promises = v2.promises;
    surface.worldRules = v2.worldRules;
    surface.continuity = v2.continuity;
    surface.metadata = v2.metadata;
    surface.recentSummary = v2.recentSummary;
    surface.story = {
      ...v2.story,
      title: current.storyMemory?.title ?? v2.story.title,
      concept: current.storyMemory?.concept ?? v2.story.concept,
      genre: current.storyMemory?.genre?.length
        ? current.storyMemory.genre
        : v2.story.genre,
      tone: current.storyMemory?.tone?.length
        ? current.storyMemory.tone
        : v2.story.tone,
      setting: current.storyMemory?.setting ?? v2.story.setting,
      plot: current.storyMemory?.plot ?? v2.story.plot,
    };
  }

  return upgradeStoryMemory(surface);
}

function wrapLegacy(v2: StoryMemoryV2): StoryMemory {
  const legacy = toLegacyStoryMemory(v2);
  return Object.assign(legacy, {
    memoryVersion: 2,
    __memoryV2: v2,
  }) as StoryMemory;
}

export function emptyStoryMemory(): StoryMemory {
  return wrapLegacy(emptyStoryMemoryV2());
}

export function parseStoryMemory(raw: unknown): StoryMemory {
  return wrapLegacy(upgradeStoryMemory(raw ?? {}));
}

/**
 * Apply a legacy MemoryPatch via the v2 merge engine.
 */
export function applyMemoryPatch(
  current: StoryMemory,
  rawPatch: unknown
): StoryMemory {
  const patchParsed = memoryPatchSchema.safeParse(rawPatch ?? {});
  const patch: MemoryPatch = patchParsed.success
    ? patchParsed.data
    : memoryPatchSchema.parse({});

  const v2 = extractV2(current);
  const v2Patch = legacyPatchToMemoryV2Patch(patch, v2);
  const allowConflicts =
    Boolean(v2Patch.corrections?.length) ||
    Boolean(v2Patch.allowConflicts);

  const result = applyMemoryV2Patch(v2, v2Patch, { allowConflicts });
  // Preserve draft unless explicitly handled (legacy patch never sets draft)
  const withDraft: StoryMemoryV2 = {
    ...result.memory,
    latestDraft: current.latestDraft ?? result.memory.latestDraft,
  };
  return wrapLegacy(withDraft);
}

export function getMemoryV2(memory: StoryMemory): StoryMemoryV2 {
  return extractV2(memory);
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
  const chars = memory.characters;
  const idFor = (c: StoryMemoryCharacter) =>
    c.tempId || `c_${c.name.toLowerCase().replace(/\s+/g, "_")}`;

  return {
    title: memory.storyMemory.title || "Untitled Story",
    genre: memory.storyMemory.genre?.[0] || "Drama",
    language: memory.storyMemory.language || "Hinglish",
    description: memory.storyMemory.concept,
    tone: memory.storyMemory.tone?.[0],
    setting: memory.storyMemory.setting,
    pointOfView: memory.storyMemory.pov,
    pacing: memory.storyMemory.pacing,
    writingStyle: memory.storyMemory.writingStyle,
    initialPlot: memory.storyMemory.plot,
    characters: chars.map((c) => ({
      clientId: idFor(c),
      name: c.name,
      role: c.role || "supporting",
      personality: (c.personality || []).join(", "),
      age:
        typeof c.age === "number"
          ? c.age
          : typeof c.age === "string" && /^\d+$/.test(c.age)
            ? Number(c.age)
            : null,
      background: c.background,
    })),
    relationships: memory.relationships.map((r) => {
      const source = chars.find(
        (c) => c.name.toLowerCase() === r.from.toLowerCase()
      );
      const target = chars.find(
        (c) => c.name.toLowerCase() === r.to.toLowerCase()
      );
      return {
        sourceClientId: source ? idFor(source) : `c_${r.from}`,
        targetClientId: target ? idFor(target) : `c_${r.to}`,
        relationshipType: r.type,
        description: r.notes,
      };
    }),
    writingRules: memory.writingRules.map((r) => ({
      rule: r.rule,
      priority:
        r.priority === "critical" ? 3 : r.priority === "important" ? 2 : 1,
      isActive: true,
    })),
  };
}

export function getMissingCreateFields(memory: StoryMemory): string[] {
  const missing: string[] = [];
  if (!memory.storyMemory.title?.trim()) missing.push("title");
  if (!memory.storyMemory.genre?.length) missing.push("genre");
  if (!memory.characters.length) missing.push("characters");
  return missing;
}

/** @deprecated Prefer getMemoryV2 — kept for transitional imports */
export function ensureParsedMemory(raw: unknown): StoryMemory {
  const parsed = storyMemorySchema.safeParse(raw ?? {});
  if (parsed.success) return wrapLegacy(upgradeStoryMemory(parsed.data));
  return emptyStoryMemory();
}
