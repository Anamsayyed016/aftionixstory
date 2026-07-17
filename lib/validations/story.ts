import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const storyVisibilitySchema = z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]);
export const storyStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const storyCoreFieldsSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: optionalText(1000),
  genre: z.string().trim().min(2).max(100),
  language: z.string().trim().min(2).max(50),
  storyType: optionalText(100),
  visibility: storyVisibilitySchema.default("PRIVATE"),
  writingStyle: optionalText(100),
  dialogueStyle: optionalText(100),
  pointOfView: optionalText(100),
  episodeLength: optionalText(100),
  tone: optionalText(100),
  romanceLevel: optionalText(100),
  pacing: optionalText(100),
  customInstructions: optionalText(4000),
  setting: optionalText(2000),
  timePeriod: optionalText(200),
  mainConflict: optionalText(2000),
  initialPlot: optionalText(4000),
  worldRules: optionalText(4000),
  contentBoundaries: optionalText(3000),
  currentSummary: optionalText(5000),
});

export const characterInputSchema = z.object({
  clientId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  age: z.coerce.number().int().min(1).max(150).optional().nullable(),
  gender: optionalText(50),
  role: z.string().trim().min(1).max(100),
  appearance: optionalText(2000),
  personality: z.string().trim().min(3).max(3000),
  background: optionalText(4000),
  speakingStyle: optionalText(2000),
  secrets: optionalText(3000),
  emotionalState: optionalText(1000),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const relationshipInputSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    sourceClientId: z.string().min(1),
    targetClientId: z.string().min(1),
    relationshipType: z.string().trim().min(1).max(100),
    description: optionalText(2000),
    currentStatus: optionalText(200),
    emotionalDynamic: optionalText(2000),
  })
  .refine((v) => v.sourceClientId !== v.targetClientId, {
    message: "A character cannot have a relationship with themselves.",
    path: ["targetClientId"],
  });

export const writingRuleInputSchema = z.object({
  clientId: z.string().min(1).optional(),
  rule: z.string().trim().min(2).max(1000),
  category: optionalText(100),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  isActive: z.boolean().default(true),
});

export const createStoryWizardSchema = storyCoreFieldsSchema.extend({
  status: storyStatusSchema.default("ACTIVE"),
  characters: z.array(characterInputSchema).min(1, "Add at least one character"),
  relationships: z.array(relationshipInputSchema).default([]),
  writingRules: z.array(writingRuleInputSchema).default([]),
});

export const saveDraftStorySchema = storyCoreFieldsSchema
  .partial({
    genre: true,
    language: true,
  })
  .extend({
    title: z.string().trim().min(3).max(120),
    genre: z.string().trim().min(2).max(100).default("Custom"),
    language: z.string().trim().min(2).max(50).default("English"),
    characters: z.array(characterInputSchema).default([]),
    relationships: z.array(relationshipInputSchema).default([]),
    writingRules: z.array(writingRuleInputSchema).default([]),
  });

export const updateStorySchema = storyCoreFieldsSchema.partial().extend({
  status: storyStatusSchema.optional(),
});

export const createCharacterSchema = characterInputSchema.omit({ clientId: true });
export const updateCharacterSchema = createCharacterSchema.partial();

export const createRelationshipSchema = z
  .object({
    sourceCharacterId: z.string().min(1),
    targetCharacterId: z.string().min(1),
    relationshipType: z.string().trim().min(1).max(100),
    description: optionalText(2000),
    currentStatus: optionalText(200),
    emotionalDynamic: optionalText(2000),
  })
  .refine((v) => v.sourceCharacterId !== v.targetCharacterId, {
    message: "A character cannot have a relationship with themselves.",
    path: ["targetCharacterId"],
  });

export const updateRelationshipSchema = z.object({
  relationshipType: z.string().trim().min(1).max(100).optional(),
  description: optionalText(2000),
  currentStatus: optionalText(200),
  emotionalDynamic: optionalText(2000),
});

export const createWritingRuleSchema = writingRuleInputSchema.omit({ clientId: true });
export const updateWritingRuleSchema = createWritingRuleSchema.partial();

export type CreateStoryWizardInput = z.infer<typeof createStoryWizardSchema>;
export type SaveDraftStoryInput = z.infer<typeof saveDraftStorySchema>;
export type CharacterInput = z.infer<typeof characterInputSchema>;
export type RelationshipInput = z.infer<typeof relationshipInputSchema>;
export type WritingRuleInput = z.infer<typeof writingRuleInputSchema>;
