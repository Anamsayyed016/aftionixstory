import { z } from "zod";

export const generationActionSchema = z.enum([
  "NEW_EPISODE",
  "CONTINUE",
  "REGENERATE",
  "IMPROVE_WRITING",
  "MORE_ROMANTIC",
  "MORE_EMOTIONAL",
  "ADD_COMEDY",
]);

export const clientRequestIdSchema = z
  .string()
  .trim()
  .min(8, "Request id is required")
  .max(80)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Request id must be alphanumeric (with _ or -)"
  );

const optionalOverride = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const generateEpisodeSchema = z.object({
  storyId: z.string().min(1),
  userInstruction: z
    .string()
    .trim()
    .min(3, "Instruction must be at least 3 characters")
    .max(5000),
  action: generationActionSchema.default("NEW_EPISODE"),
  toneOverride: optionalOverride,
  lengthOverride: optionalOverride,
  sourceEpisodeId: z.string().min(1).optional(),
  clientRequestId: clientRequestIdSchema,
});

export const saveEpisodeSchema = z.object({
  storyId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(20, "Episode content is too short").max(100_000),
  userInstruction: z.string().trim().max(5000).optional(),
  generationAction: generationActionSchema.optional(),
  clientRequestId: clientRequestIdSchema.optional(),
  /** When set, overwrite this saved episode (after creating a version). */
  replaceEpisodeId: z.string().min(1).optional(),
});

export const updateEpisodeSchema = z.object({
  episodeId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(20).max(100_000),
  changeReason: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "manual_edit")),
});

export const regenerateEpisodeSchema = z.object({
  storyId: z.string().min(1),
  sourceEpisodeId: z.string().min(1),
  userInstruction: z
    .string()
    .trim()
    .min(3)
    .max(5000)
    .default("Regenerate this episode with improved quality while preserving continuity."),
  action: generationActionSchema.default("REGENERATE"),
  toneOverride: optionalOverride,
  lengthOverride: optionalOverride,
  clientRequestId: clientRequestIdSchema,
});

export const deleteEpisodeSchema = z.object({
  episodeId: z.string().min(1),
});

export type GenerateEpisodeInput = z.infer<typeof generateEpisodeSchema>;
export type SaveEpisodeInput = z.infer<typeof saveEpisodeSchema>;
export type UpdateEpisodeInput = z.infer<typeof updateEpisodeSchema>;
export type RegenerateEpisodeInput = z.infer<typeof regenerateEpisodeSchema>;
