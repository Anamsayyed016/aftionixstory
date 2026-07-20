/**
 * Canonical Memory v2 patch contract.
 */

import { z } from "zod";
import {
  characterV2Schema,
  continuityV2Schema,
  eventV2Schema,
  locationV2Schema,
  objectV2Schema,
  openThreadV2Schema,
  promiseV2Schema,
  relationshipV2Schema,
  secretV2Schema,
  storyCoreV2Schema,
  timelineV2Schema,
  userPreferencesV2Schema,
  worldRuleV2Schema,
  writingRuleV2Schema,
} from "@/lib/story-memory/v2/schema";

const partialCharacter = characterV2Schema.partial().extend({
  name: z.string().trim().min(1).max(100).optional(),
  id: z.string().min(1).optional(),
  /** When true, list fields replace instead of merge */
  replaceTraits: z.boolean().optional(),
  replaceGoals: z.boolean().optional(),
  replaceNotes: z.boolean().optional(),
  replaceAliases: z.boolean().optional(),
  avoid: z.array(z.string()).optional(),
});

const correctionPatchSchema = z.object({
  entityType: z.enum([
    "character",
    "relationship",
    "location",
    "preference",
    "writing_rule",
    "story",
  ]),
  target: z.record(z.string(), z.unknown()).default({}),
  incorrectValue: z.unknown().optional(),
  correctValue: z.unknown().optional(),
  reason: z.string().nullable().optional().default(null),
  field: z.string().optional(),
});

const removeOpSchema = z.object({
  type: z.enum([
    "character",
    "relationship",
    "location",
    "object",
    "event",
    "timeline",
    "open_thread",
    "secret",
    "promise",
    "world_rule",
    "writing_rule",
    "preference_key",
  ]),
  id: z.string().optional(),
  name: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  rule: z.string().optional(),
  key: z.string().optional(),
});

export const memoryV2PatchSchema = z.object({
  set: storyCoreV2Schema.partial().default({}),
  upsertCharacters: z.array(partialCharacter).default([]),
  upsertRelationships: z
    .array(
      relationshipV2Schema.partial().extend({
        id: z.string().optional(),
        fromCharacterId: z.string().optional(),
        toCharacterId: z.string().optional(),
        fromName: z.string().optional(),
        toName: z.string().optional(),
        type: z.string().optional(),
        replace: z.boolean().optional(),
      })
    )
    .default([]),
  upsertLocations: z
    .array(locationV2Schema.partial().extend({ id: z.string().optional(), name: z.string().optional() }))
    .default([]),
  upsertObjects: z
    .array(objectV2Schema.partial().extend({ id: z.string().optional(), name: z.string().optional() }))
    .default([]),
  upsertEvents: z
    .array(eventV2Schema.partial().extend({ id: z.string().optional(), title: z.string().optional() }))
    .default([]),
  upsertTimeline: z
    .array(timelineV2Schema.partial().extend({ id: z.string().optional(), label: z.string().optional() }))
    .default([]),
  upsertOpenThreads: z
    .array(openThreadV2Schema.partial().extend({ id: z.string().optional(), title: z.string().optional() }))
    .default([]),
  upsertSecrets: z
    .array(secretV2Schema.partial().extend({ id: z.string().optional(), title: z.string().optional() }))
    .default([]),
  upsertPromises: z
    .array(promiseV2Schema.partial().extend({ id: z.string().optional(), text: z.string().optional() }))
    .default([]),
  upsertWorldRules: z
    .array(worldRuleV2Schema.partial().extend({ id: z.string().optional(), rule: z.string().optional() }))
    .default([]),
  upsertWritingRules: z
    .array(writingRuleV2Schema.partial().extend({ id: z.string().optional(), rule: z.string().optional() }))
    .default([]),
  updatePreferences: userPreferencesV2Schema.partial().default({}),
  updateContinuity: continuityV2Schema.partial().default({}),
  setLatestDraft: z
    .union([
      z.null(),
      z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        wordCount: z.number().optional(),
        episodeNumber: z.number().optional(),
        clientRequestId: z.string().optional(),
        action: z.string().optional(),
        replaceEpisodeId: z.string().optional(),
        sourceConversationId: z.string().optional(),
      }),
    ])
    .optional(),
  remove: z.array(removeOpSchema).default([]),
  corrections: z.array(correctionPatchSchema).default([]),
  /** Allow overwriting conflicting scalar fields (correction intent). */
  allowConflicts: z.boolean().optional().default(false),
  /** Expected revision for stale-write protection. */
  expectedRevision: z.number().int().nonnegative().optional(),
});

export type MemoryV2Patch = z.infer<typeof memoryV2PatchSchema>;
export type CorrectionPatch = z.infer<typeof correctionPatchSchema>;
