/**
 * Project DynamicContext → legacy CompactStoryContext / filtered StoryMemory.
 */

import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import type { DynamicContext } from "@/lib/context-builder/v2/schema";
import { serializeDynamicContextForPrompt } from "@/lib/context-builder/v2/serialize";
import type { StoryOperation } from "@/lib/story-agent/operations";
import type { StoryMemory } from "@/lib/story-agent/schema";
import {
  emptyStoryMemory,
  getMemoryV2,
} from "@/lib/story-agent/memory-patch";
import { toLegacyStoryMemory } from "@/lib/story-memory/v2";
import type { StoryMemoryV2 } from "@/lib/story-memory/v2";
import {
  detectLanguageInstruction,
  languagePrefsToStoryLanguageLabel,
  readLanguagePreferences,
} from "@/lib/story-agent/language-preferences";

/**
 * Build a filtered StoryMemory from selected context only.
 * Preserves __memoryV2 from full memory for safe patch application when attached.
 */
export function dynamicContextToLegacyStoryMemory(
  ctx: DynamicContext,
  fullMemory?: StoryMemory
): StoryMemory {
  const base = emptyStoryMemory();
  const filtered: StoryMemoryV2 = {
    ...getMemoryV2(base),
    memoryVersion: 2,
    story: {
      title: ctx.story.title ?? null,
      concept: ctx.story.concept ?? null,
      genre: ctx.story.genre ?? [],
      tone: ctx.story.tone ?? [],
      themes: ctx.story.themes ?? [],
      setting: ctx.story.setting ?? null,
      plot: null,
      status: "exploring",
      language: null,
      pov: null,
      pacing: null,
      writingStyle: null,
    },
    characters: ctx.characters.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
      role: c.role ?? null,
      gender: c.gender ?? null,
      age: c.age ?? null,
      occupation: c.occupation ?? null,
      personalityTraits: c.personalityTraits,
      appearance: [],
      goals: c.goals,
      fears: c.fears,
      strengths: c.strengths,
      weaknesses: c.weaknesses,
      backstory: null,
      currentState: c.currentState ?? null,
      status: (c.status as "active") || "active",
      notes: c.notes,
      avoid: c.avoid,
      createdAt: null,
      updatedAt: null,
    })),
    relationships: ctx.relationships.map((r) => ({
      id: r.id,
      fromCharacterId: r.fromCharacterId,
      toCharacterId: r.toCharacterId,
      type: r.type,
      label: r.label ?? null,
      status: (r.status as "active") || "developing",
      mutual: Boolean(r.mutual),
      history: r.recentHistory,
      conflicts: r.conflicts,
      secrets: r.secrets,
      notes: [],
      supersededById: null,
      correctedFromId: null,
      updatedAt: null,
    })),
    locations: ctx.locations.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type ?? null,
      description: l.description ?? null,
      mood: l.mood ?? null,
      importance: (l.importance as "secondary") || "secondary",
      rules: [],
      relatedCharacterIds: [],
      notes: [],
    })),
    writingRules: ctx.writingRules.map((r) => ({
      id: r.id,
      rule: r.rule,
      category: r.category ?? null,
      priority: (r.priority as "normal") || "normal",
      active: r.active !== false,
      source: "user" as const,
      createdAt: null,
      updatedAt: null,
    })),
    userPreferences: {
      ...getMemoryV2(base).userPreferences,
      ...(ctx.preferences as object),
    },
    continuity: {
      ...getMemoryV2(base).continuity,
      ...(ctx.continuity as object),
    },
    latestDraft: ctx.latestDraft
      ? {
          title: ctx.latestDraft.title,
          content: ctx.latestDraft.content,
          wordCount: ctx.latestDraft.wordCount,
        }
      : null,
    openThreads: ctx.openThreads.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      status: (t.status as "open") || "open",
      priority: (t.priority as "medium") || "medium",
      introducedAtEpisode: null,
      relatedCharacterIds: t.relatedCharacterIds,
      relatedEventIds: [],
      possibleResolutions: [],
      resolvedAtEpisode: null,
    })),
    events: ctx.events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? null,
      type: e.type ?? null,
      episodeNumber: e.episodeNumber ?? null,
      sceneId: null,
      characterIds: e.characterIds,
      locationId: e.locationId ?? null,
      order: e.order ?? null,
      importance: (e.importance as "major") || "major",
      resolved: false,
      causes: [],
      consequences: [],
    })),
    secrets: [],
    promises: ctx.promises.map((p) => ({
      id: p.id,
      text: p.text,
      madeByCharacterId: p.madeByCharacterId ?? null,
      madeToCharacterId: p.madeToCharacterId ?? null,
      episodeNumber: null,
      status: (p.status as "active") || "active",
      fulfilledAtEpisode: null,
      brokenAtEpisode: null,
      history: [],
    })),
    objects: [],
    timeline: ctx.timeline.map((t) => ({
      id: t.id,
      label: t.label,
      sequence: t.sequence ?? 0,
      absoluteDate: null,
      relativeTime: t.relativeTime ?? null,
      eventIds: [],
      notes: [],
    })),
    worldRules: ctx.worldRules.map((w) => ({
      id: w.id,
      rule: w.rule,
      category: w.category ?? null,
      strict: true,
      exceptions: [],
      notes: [],
    })),
    recentSummary: ctx.recentSummary ?? null,
    metadata: {
      memoryConflicts: [],
      correctionHistory: [],
      warnings: [],
      revision: 0,
    },
  };

  const legacy = toLegacyStoryMemory(filtered);
  // Attach full v2 for patch safety when provided
  if (fullMemory) {
    return Object.assign(legacy, {
      memoryVersion: 2,
      __memoryV2: getMemoryV2(fullMemory),
    }) as StoryMemory;
  }
  return Object.assign(legacy, {
    memoryVersion: 2,
    __memoryV2: filtered,
  }) as StoryMemory;
}

/**
 * Map DynamicContext → CompactStoryContext for existing prompt builders.
 */
export function dynamicContextToCompactStoryContext(params: {
  ctx: DynamicContext;
  operation: StoryOperation;
  userMessage: string;
  conversationId?: string;
  storyId?: string | null;
  fullMemory?: StoryMemory;
}): CompactStoryContext {
  const { ctx, operation, userMessage } = params;
  const prefs = readLanguagePreferences({
    narrationLanguage: String(ctx.preferences.narrationLanguage || ""),
    dialogueLanguage: String(ctx.preferences.dialogueLanguage || ""),
    mirrorUserLanguage: true,
    storyLanguage: String(ctx.preferences.storyLanguage || ""),
  });
  const detected = detectLanguageInstruction(userMessage, prefs);

  return {
    operation,
    conversationId: params.conversationId,
    storyId: params.storyId,
    userInstruction: userMessage,
    languageHint: detected.matched
      ? languagePrefsToStoryLanguageLabel(detected.resolved)
      : String(
          ctx.preferences.responseLanguage ||
            ctx.preferences.storyLanguage ||
            ctx.preferences.dialogueLanguage ||
            "mirror user message"
        ),
    languagePrefs: prefs,
    concept: ctx.story.concept ?? undefined,
    title: ctx.story.title ?? undefined,
    genre: ctx.story.genre || [],
    tone: ctx.story.tone || [],
    setting: ctx.story.setting ?? undefined,
    characters: ctx.characters.map((c) => ({
      name: c.name,
      role: c.role ?? undefined,
      personality: c.personalityTraits,
      avoid: c.avoid,
      notes: c.notes,
    })),
    relationships: ctx.relationships.map((r) => ({
      from: r.fromName || r.fromCharacterId,
      to: r.toName || r.toCharacterId,
      type: r.type,
      notes: r.recentHistory[0],
    })),
    writingRules: ctx.writingRules.map((r) => r.rule),
    preferences: {
      dialogueLanguage: String(ctx.preferences.dialogueLanguage || "") || undefined,
      narrationLanguage:
        String(ctx.preferences.narrationLanguage || "") || undefined,
      uppercaseForLoudDialogue: Boolean(ctx.preferences.uppercaseForLoudDialogue),
      slowBurn: Boolean(ctx.preferences.slowBurn),
      avoid: Array.isArray(ctx.preferences.avoid)
        ? (ctx.preferences.avoid as string[])
        : [],
    },
    latestDraftPreview: ctx.latestDraft?.content,
    includeLatestDraft: Boolean(ctx.latestDraft?.content),
    recentMessages: ctx.recentConversation.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    namedInRequest: ctx.characters.map((c) => c.name),
    actionHints: [],
    conflictHints: [],
    promptSectionNames: [
      ctx.characters.length ? "characters" : "",
      ctx.relationships.length ? "relationships" : "",
      ctx.writingRules.length ? "writingRules" : "",
      ctx.latestDraft ? "latestDraft" : "",
      "preferences",
    ].filter(Boolean),
  };
}

/** Alias requested by Phase D spec. */
export function dynamicContextToLegacyOperationContext(
  ctx: DynamicContext,
  fullMemory?: StoryMemory
): StoryMemory {
  return dynamicContextToLegacyStoryMemory(ctx, fullMemory);
}

export function contextPromptBlock(ctx: DynamicContext): string {
  return serializeDynamicContextForPrompt(ctx);
}
