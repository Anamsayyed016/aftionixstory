/**
 * Memory Model v2 — Zod schemas (Phase C).
 * Storage remains Conversation.state JSON; no Prisma.
 */

import { z } from "zod";

const optionalString = z.preprocess((v) => {
  if (v == null) return null;
  const t = String(v).trim();
  return t.length > 0 ? t : null;
}, z.string().nullable());

const stringList = z.preprocess((v) => {
  if (v == null) return [];
  if (!Array.isArray(v)) {
    const t = String(v).trim();
    return t ? [t] : [];
  }
  return v
    .map((item) => (item == null ? "" : String(item).trim()))
    .filter((item) => item.length > 0);
}, z.array(z.string()).default([]));

export const MEMORY_VERSION = 2 as const;

export const storyStatusV2Schema = z.enum([
  "exploring",
  "shaping",
  "ready_to_write",
  "writing",
  "brainstorming",
  "ready",
  "created",
]);

export const characterStatusSchema = z.enum([
  "active",
  "inactive",
  "archived",
]);

export const relationshipStatusSchema = z.enum([
  "developing",
  "active",
  "strained",
  "ended",
  "corrected",
  "superseded",
]);

export const importanceSchema = z.enum([
  "minor",
  "secondary",
  "important",
  "major",
  "critical",
]);

export const characterV2Schema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    aliases: stringList,
    role: optionalString,
    gender: optionalString,
    age: z.union([z.number(), z.string(), z.null()]).optional().nullable(),
    occupation: optionalString,
    personalityTraits: stringList,
    appearance: stringList,
    goals: stringList,
    fears: stringList,
    strengths: stringList,
    weaknesses: stringList,
    backstory: optionalString,
    currentState: optionalString,
    status: characterStatusSchema.default("active"),
    notes: stringList,
    avoid: stringList,
    createdAt: z.string().optional().nullable(),
    updatedAt: z.string().optional().nullable(),
  })
  .passthrough();

export const relationshipV2Schema = z
  .object({
    id: z.string().min(1),
    fromCharacterId: z.string().min(1),
    toCharacterId: z.string().min(1),
    type: z.string().trim().min(1).max(100),
    label: optionalString,
    status: relationshipStatusSchema.default("developing"),
    mutual: z.boolean().default(false),
    history: z.array(z.string()).default([]),
    conflicts: stringList,
    secrets: stringList,
    notes: stringList,
    supersededById: z.string().nullable().optional().default(null),
    correctedFromId: z.string().nullable().optional().default(null),
    updatedAt: z.string().optional().nullable(),
  })
  .passthrough();

export const locationV2Schema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    type: optionalString,
    description: optionalString,
    mood: optionalString,
    importance: importanceSchema.default("secondary"),
    rules: stringList,
    relatedCharacterIds: z.array(z.string()).default([]),
    notes: stringList,
  })
  .passthrough();

export const objectV2Schema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    type: optionalString,
    description: optionalString,
    ownerCharacterId: z.string().nullable().optional().default(null),
    locationId: z.string().nullable().optional().default(null),
    importance: importanceSchema.default("important"),
    status: z.enum(["active", "lost", "destroyed", "archived"]).default("active"),
    history: z.array(z.string()).default([]),
  })
  .passthrough();

export const eventV2Schema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    description: optionalString,
    type: optionalString,
    episodeNumber: z.number().int().positive().nullable().optional().default(null),
    sceneId: z.string().nullable().optional().default(null),
    characterIds: z.array(z.string()).default([]),
    locationId: z.string().nullable().optional().default(null),
    order: z.number().nullable().optional().default(null),
    importance: importanceSchema.default("major"),
    resolved: z.boolean().default(false),
    causes: stringList,
    consequences: stringList,
  })
  .passthrough();

export const timelineV2Schema = z
  .object({
    id: z.string().min(1),
    label: z.string().trim().min(1).max(200),
    sequence: z.number().int().default(0),
    absoluteDate: optionalString,
    relativeTime: optionalString,
    eventIds: z.array(z.string()).default([]),
    notes: stringList,
  })
  .passthrough();

export const openThreadV2Schema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    description: optionalString,
    status: z.enum(["open", "paused", "resolved", "abandoned"]).default("open"),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    introducedAtEpisode: z.number().int().positive().nullable().optional().default(null),
    relatedCharacterIds: z.array(z.string()).default([]),
    relatedEventIds: z.array(z.string()).default([]),
    possibleResolutions: stringList,
    resolvedAtEpisode: z.number().int().positive().nullable().optional().default(null),
  })
  .passthrough();

export const secretV2Schema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    description: optionalString,
    knownByCharacterIds: z.array(z.string()).default([]),
    hiddenFromCharacterIds: z.array(z.string()).default([]),
    revealed: z.boolean().default(false),
    revealedAtEpisode: z.number().int().positive().nullable().optional().default(null),
    importance: importanceSchema.default("major"),
  })
  .passthrough();

export const promiseV2Schema = z
  .object({
    id: z.string().min(1),
    text: z.string().trim().min(1).max(500),
    madeByCharacterId: z.string().nullable().optional().default(null),
    madeToCharacterId: z.string().nullable().optional().default(null),
    episodeNumber: z.number().int().positive().nullable().optional().default(null),
    status: z.enum(["active", "fulfilled", "broken", "forgotten"]).default("active"),
    fulfilledAtEpisode: z.number().int().positive().nullable().optional().default(null),
    brokenAtEpisode: z.number().int().positive().nullable().optional().default(null),
    history: z.array(z.string()).default([]),
  })
  .passthrough();

export const worldRuleV2Schema = z
  .object({
    id: z.string().min(1),
    rule: z.string().trim().min(1).max(1000),
    category: optionalString,
    strict: z.boolean().default(true),
    exceptions: stringList,
    notes: stringList,
  })
  .passthrough();

export const writingRuleV2Schema = z
  .object({
    id: z.string().min(1),
    rule: z.string().trim().min(2).max(1000),
    category: optionalString,
    priority: z.enum(["low", "normal", "high", "important", "critical"]).default("normal"),
    active: z.boolean().default(true),
    source: z.enum(["user", "system", "inferred"]).default("user"),
    createdAt: z.string().optional().nullable(),
    updatedAt: z.string().optional().nullable(),
  })
  .passthrough();

export const storyCoreV2Schema = z
  .object({
    title: optionalString.default(null),
    concept: optionalString.default(null),
    genre: stringList,
    tone: stringList,
    themes: stringList,
    setting: optionalString.default(null),
    plot: optionalString.default(null),
    status: storyStatusV2Schema.default("exploring"),
    language: optionalString.default(null),
    pov: optionalString.default(null),
    pacing: optionalString.default(null),
    writingStyle: optionalString.default(null),
  })
  .passthrough();

export const userPreferencesV2Schema = z
  .object({
    language: optionalString.default(null),
    responseLanguage: optionalString.default(null),
    storyLanguage: optionalString.default(null),
    emojiLevel: optionalString.default(null),
    dialogueStyle: optionalString.default(null),
    narrationStyle: optionalString.default(null),
    pacing: optionalString.default(null),
    pov: optionalString.default(null),
    tone: stringList,
    preferredGenres: stringList,
    avoid: stringList,
    custom: z.record(z.string(), z.unknown()).default({}),
    // Legacy flags preserved
    dialogueLanguage: optionalString.default(null),
    narrationLanguage: optionalString.default(null),
    scriptPreference: optionalString.default(null),
    mirrorUserLanguage: z.boolean().optional().default(true),
    format: optionalString.default(null),
    episodeLength: optionalString.default(null),
    uppercaseForLoudDialogue: z.boolean().optional().default(false),
    slowBurn: z.boolean().optional().default(false),
    doNotStartYet: z.boolean().optional().default(false),
    formality: optionalString.default(null),
    emojiStyle: optionalString.default(null),
    avoidFormalHindi: z.boolean().optional().default(true),
    preferShortDialogues: z.boolean().optional().default(false),
    pacingHint: optionalString.default(null),
  })
  .passthrough();

export const continuityV2Schema = z
  .object({
    lastScene: optionalString.default(null),
    lastEpisodeNumber: z.number().int().positive().nullable().optional().default(null),
    currentLocationId: z.string().nullable().optional().default(null),
    activeCharacterIds: z.array(z.string()).default([]),
    currentConflict: optionalString.default(null),
    currentMood: optionalString.default(null),
    currentTimelineId: z.string().nullable().optional().default(null),
    lastUserInstruction: optionalString.default(null),
  })
  .passthrough();

export const latestDraftV2Schema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    wordCount: z.number().optional(),
    episodeNumber: z.number().optional(),
    clientRequestId: z.string().optional(),
    action: z.string().optional(),
    replaceEpisodeId: z.string().optional(),
    sourceConversationId: z.string().optional(),
  })
  .nullable()
  .optional();

export const memoryConflictSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().nullable().optional().default(null),
  field: z.string().min(1),
  existingValue: z.unknown(),
  incomingValue: z.unknown(),
  status: z.enum(["unresolved", "accepted_incoming", "kept_existing", "corrected"]).default("unresolved"),
  createdAt: z.string(),
  reason: z.string().nullable().optional().default(null),
});

export const correctionRecordSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  target: z.record(z.string(), z.unknown()).default({}),
  incorrectValue: z.unknown().optional(),
  correctValue: z.unknown().optional(),
  reason: z.string().nullable().optional().default(null),
  appliedAt: z.string(),
  supersededEntityId: z.string().nullable().optional().default(null),
  newEntityId: z.string().nullable().optional().default(null),
});

export const memoryMetadataV2Schema = z
  .object({
    memoryConflicts: z.array(memoryConflictSchema).default([]),
    correctionHistory: z.array(correctionRecordSchema).default([]),
    warnings: z.array(z.string()).default([]),
    revision: z.number().int().nonnegative().default(0),
  })
  .passthrough();

export const storyMemoryV2Schema = z
  .object({
    memoryVersion: z.literal(2).default(2),
    story: z.preprocess((v) => v ?? {}, storyCoreV2Schema),
    characters: z.array(characterV2Schema).default([]),
    relationships: z.array(relationshipV2Schema).default([]),
    locations: z.array(locationV2Schema).default([]),
    objects: z.array(objectV2Schema).default([]),
    events: z.array(eventV2Schema).default([]),
    timeline: z.array(timelineV2Schema).default([]),
    openThreads: z.array(openThreadV2Schema).default([]),
    secrets: z.array(secretV2Schema).default([]),
    promises: z.array(promiseV2Schema).default([]),
    worldRules: z.array(worldRuleV2Schema).default([]),
    writingRules: z.array(writingRuleV2Schema).default([]),
    userPreferences: z.preprocess((v) => v ?? {}, userPreferencesV2Schema),
    continuity: z.preprocess((v) => v ?? {}, continuityV2Schema),
    latestDraft: latestDraftV2Schema.default(null),
    recentSummary: optionalString.default(null),
    metadata: z.preprocess((v) => v ?? {}, memoryMetadataV2Schema),
    updatedAt: z.string().optional().nullable(),
  })
  .passthrough();

export type StoryMemoryV2 = z.infer<typeof storyMemoryV2Schema>;
export type CharacterV2 = z.infer<typeof characterV2Schema>;
export type RelationshipV2 = z.infer<typeof relationshipV2Schema>;
export type LocationV2 = z.infer<typeof locationV2Schema>;
export type ObjectV2 = z.infer<typeof objectV2Schema>;
export type EventV2 = z.infer<typeof eventV2Schema>;
export type TimelineV2 = z.infer<typeof timelineV2Schema>;
export type OpenThreadV2 = z.infer<typeof openThreadV2Schema>;
export type SecretV2 = z.infer<typeof secretV2Schema>;
export type PromiseV2 = z.infer<typeof promiseV2Schema>;
export type WorldRuleV2 = z.infer<typeof worldRuleV2Schema>;
export type WritingRuleV2 = z.infer<typeof writingRuleV2Schema>;
export type ContinuityV2 = z.infer<typeof continuityV2Schema>;
export type UserPreferencesV2 = z.infer<typeof userPreferencesV2Schema>;
export type MemoryConflict = z.infer<typeof memoryConflictSchema>;
export type CorrectionRecord = z.infer<typeof correctionRecordSchema>;

/** Soft caps — warn, do not truncate destructively. */
export const MEMORY_SOFT_CAPS = {
  characters: 200,
  relationships: 500,
  locations: 200,
  objects: 200,
  events: 500,
  timeline: 200,
  openThreads: 200,
  secrets: 200,
  promises: 200,
  worldRules: 200,
  writingRules: 200,
} as const;
