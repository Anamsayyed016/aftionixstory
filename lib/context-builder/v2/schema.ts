/**
 * Dynamic Context Builder v2 — Zod contracts (Phase D).
 */

import { z } from "zod";

export const CONTEXT_VERSION = 2 as const;

export const contextLimitsSchema = z.object({
  maxCharacters: z.number().int().positive().default(8),
  maxRelationships: z.number().int().positive().default(12),
  maxEvents: z.number().int().positive().default(10),
  maxOpenThreads: z.number().int().positive().default(6),
  maxLocations: z.number().int().positive().default(3),
  maxObjects: z.number().int().positive().default(4),
  maxSecrets: z.number().int().positive().default(4),
  maxPromises: z.number().int().positive().default(4),
  maxWritingRules: z.number().int().positive().default(20),
  maxRecentMessages: z.number().int().positive().default(10),
  maxDraftChars: z.number().int().positive().default(12_000),
  maxTotalEstimatedTokens: z.number().int().positive().default(7000),
});

export type ContextLimits = z.infer<typeof contextLimitsSchema>;

export const DEFAULT_CONTEXT_LIMITS: ContextLimits = contextLimitsSchema.parse({});

export const scoredEntityMetaSchema = z.object({
  entityId: z.string(),
  score: z.number(),
  reasons: z.array(z.string()).default([]),
});

export type ScoredEntityMeta = z.infer<typeof scoredEntityMetaSchema>;

export const contextCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  role: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  age: z.union([z.number(), z.string(), z.null()]).optional().nullable(),
  occupation: z.string().nullable().optional(),
  personalityTraits: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  fears: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  currentState: z.string().nullable().optional(),
  status: z.string().optional(),
  notes: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
});

export const contextRelationshipSchema = z.object({
  id: z.string(),
  fromCharacterId: z.string(),
  toCharacterId: z.string(),
  fromName: z.string().optional(),
  toName: z.string().optional(),
  type: z.string(),
  label: z.string().nullable().optional(),
  status: z.string().optional(),
  mutual: z.boolean().optional(),
  recentHistory: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  secrets: z.array(z.string()).default([]),
});

export const contextLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
  importance: z.string().optional(),
});

export const contextEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  episodeNumber: z.number().nullable().optional(),
  characterIds: z.array(z.string()).default([]),
  locationId: z.string().nullable().optional(),
  importance: z.string().optional(),
  order: z.number().nullable().optional(),
});

export const contextThreadSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  relatedCharacterIds: z.array(z.string()).default([]),
});

export const contextSecretSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  knownByCharacterIds: z.array(z.string()).default([]),
  hiddenFromCharacterIds: z.array(z.string()).default([]),
  revealed: z.boolean().optional(),
  importance: z.string().optional(),
});

export const contextPromiseSchema = z.object({
  id: z.string(),
  text: z.string(),
  madeByCharacterId: z.string().nullable().optional(),
  madeToCharacterId: z.string().nullable().optional(),
  status: z.string().optional(),
});

export const contextWritingRuleSchema = z.object({
  id: z.string(),
  rule: z.string(),
  category: z.string().nullable().optional(),
  priority: z.string().optional(),
  active: z.boolean().optional(),
});

export const contextMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  reason: z.string().optional(),
});

export const contextDraftSchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    wordCount: z.number().optional(),
    truncated: z.boolean().default(false),
    strategy: z.enum(["full", "ending", "begin_end", "none"]).default("none"),
  })
  .nullable();

export const contextKnowledgeSchema = z.object({
  authorKnowledge: z.array(z.string()).default([]),
  characterKnowledge: z.record(z.string(), z.array(z.string())).default({}),
});

export const contextRetrievalSchema = z.object({
  includedEntityIds: z.array(z.string()).default([]),
  excludedCounts: z.record(z.string(), z.number()).default({}),
  reasons: z.array(scoredEntityMetaSchema).default([]),
  estimatedTokens: z.number().default(0),
  sectionTokens: z.record(z.string(), z.number()).default({}),
  truncated: z.boolean().default(false),
  truncatedDraft: z.boolean().default(false),
});

export const dynamicContextSchema = z.object({
  contextVersion: z.literal(2).default(2),
  operation: z.string(),
  intent: z.string().optional(),
  story: z
    .object({
      title: z.string().nullable().optional(),
      concept: z.string().nullable().optional(),
      genre: z.array(z.string()).default([]),
      tone: z.array(z.string()).default([]),
      themes: z.array(z.string()).default([]),
      setting: z.string().nullable().optional(),
    })
    .default({ genre: [], tone: [], themes: [] }),
  characters: z.array(contextCharacterSchema).default([]),
  relationships: z.array(contextRelationshipSchema).default([]),
  locations: z.array(contextLocationSchema).default([]),
  objects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .default([]),
  events: z.array(contextEventSchema).default([]),
  timeline: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        sequence: z.number().optional(),
        relativeTime: z.string().nullable().optional(),
      })
    )
    .default([]),
  openThreads: z.array(contextThreadSchema).default([]),
  secrets: z.array(contextSecretSchema).default([]),
  promises: z.array(contextPromiseSchema).default([]),
  worldRules: z
    .array(
      z.object({
        id: z.string(),
        rule: z.string(),
        category: z.string().nullable().optional(),
      })
    )
    .default([]),
  writingRules: z.array(contextWritingRuleSchema).default([]),
  preferences: z.record(z.string(), z.unknown()).default({}),
  continuity: z.record(z.string(), z.unknown()).default({}),
  recentConversation: z.array(contextMessageSchema).default([]),
  latestDraft: contextDraftSchema.default(null),
  recentSummary: z.string().nullable().optional(),
  knowledge: contextKnowledgeSchema.default({
    authorKnowledge: [],
    characterKnowledge: {},
  }),
  retrieval: contextRetrievalSchema.default({
    includedEntityIds: [],
    excludedCounts: {},
    reasons: [],
    estimatedTokens: 0,
    sectionTokens: {},
    truncated: false,
    truncatedDraft: false,
  }),
});

export type DynamicContext = z.infer<typeof dynamicContextSchema>;
