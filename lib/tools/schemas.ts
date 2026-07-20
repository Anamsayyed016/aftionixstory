/**
 * Zod schemas for ToolRequest / ToolResult (Phase G).
 */

import { z } from "zod";
import { memoryV2PatchSchema } from "@/lib/story-memory/v2/patch";

export const TOOL_IDS = [
  "character.create",
  "character.rename",
  "character.update",
  "character.merge",
  "character.archive",
  "character.restore",
  "relationship.create",
  "relationship.update",
  "relationship.merge",
  "relationship.remove",
  "location.create",
  "location.update",
  "location.remove",
  "timeline.add_event",
  "timeline.update",
  "timeline.reorder",
  "story.rename",
  "story.concept",
  "story.genre",
  "story.tone",
  "writing_rules.add",
  "writing_rules.update",
  "writing_rules.remove",
  "preferences.language",
  "preferences.tone",
  "preferences.pacing",
  "preferences.style",
  "search.character",
  "search.relationship",
  "search.events",
  "search.timeline",
  "validation.continuity",
  "validation.duplicate_characters",
  "validation.relationship",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const toolIdSchema = z.enum(TOOL_IDS);

export const toolRequestSchema = z.object({
  toolId: toolIdSchema,
  arguments: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().min(1).max(500).optional().default("user_request"),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

export type ToolRequest = z.infer<typeof toolRequestSchema>;

export const toolRequestsEnvelopeSchema = z.object({
  toolRequests: z.array(toolRequestSchema).min(1).max(12),
  assistantReply: z.string().optional(),
});

export const toolResultSchema = z.object({
  success: z.boolean(),
  toolId: toolIdSchema.optional(),
  patch: memoryV2PatchSchema.optional(),
  updatedEntities: z
    .array(
      z.object({
        type: z.string(),
        id: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  summary: z.string().default(""),
  executionMetadata: z
    .object({
      durationMs: z.number().nonnegative().default(0),
      entityCount: z.number().int().nonnegative().default(0),
      rolledBack: z.boolean().optional(),
    })
    .default({ durationMs: 0, entityCount: 0 }),
  /** Search / validation payloads — never story prose */
  data: z.unknown().optional(),
});

export type ToolResult = z.infer<typeof toolResultSchema>;
