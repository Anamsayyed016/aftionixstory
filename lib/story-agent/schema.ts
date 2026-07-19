import { z } from "zod";

export const storyAgentIntentSchema = z.enum([
  "chat",
  "update_story",
  "brainstorm",
  "ask_question",
  "start_story",
  "create_story",
  "continue_story",
  "generate_episode",
  "revise_episode",
  "summarize",
  "inspect_memory",
  "manage_character",
  "manage_rule",
  "unknown",
]);

export type StoryAgentIntent = z.infer<typeof storyAgentIntentSchema>;

export const storyAgentActionTypeSchema = z.enum([
  "none",
  "create_story",
  "generate_episode",
  "revise_draft",
  "save_episode",
  "show_review",
  "suggest_options",
]);

export type StoryAgentActionType = z.infer<typeof storyAgentActionTypeSchema>;

export const storyMemoryStatusSchema = z.enum([
  "brainstorming",
  "ready",
  "created",
]);

const optionalString = z.preprocess((v) => {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t.length > 0 ? t : undefined;
}, z.string().optional());

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

const personalityList = z.preprocess((v) => {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean);
  }
  const t = String(v).trim();
  return t ? [t] : [];
}, z.array(z.string()).default([]));

export const storyMemoryCharacterSchema = z.object({
  tempId: optionalString,
  name: z.string().trim().min(1).max(100),
  role: optionalString,
  age: z.union([z.number(), z.string(), z.null()]).optional().nullable(),
  personality: personalityList,
  background: optionalString,
  goals: stringList,
  conflicts: stringList,
  notes: stringList,
  avoid: stringList,
});

export const storyMemoryRelationshipSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
  type: z.string().trim().min(1).max(100),
  notes: optionalString,
});

export const storyMemoryRuleSchema = z.object({
  rule: z.string().trim().min(2).max(1000),
  priority: z
    .enum(["normal", "important", "critical"])
    .optional()
    .default("normal"),
});

export const storyMemoryCoreSchema = z.object({
  concept: optionalString,
  title: optionalString,
  genre: stringList,
  language: optionalString,
  tone: stringList,
  setting: optionalString,
  plot: optionalString,
  themes: stringList,
  pov: optionalString,
  pacing: optionalString,
  writingStyle: optionalString,
  storyStatus: storyMemoryStatusSchema.optional().default("brainstorming"),
});

export const userPreferencesSchema = z.object({
  dialogueLanguage: optionalString,
  narrationLanguage: optionalString,
  scriptPreference: optionalString,
  mirrorUserLanguage: z.boolean().optional().default(true),
  format: optionalString,
  episodeLength: optionalString,
  uppercaseForLoudDialogue: z.boolean().optional().default(false),
  slowBurn: z.boolean().optional().default(false),
  doNotStartYet: z.boolean().optional().default(false),
  formality: optionalString,
  dialogueStyle: optionalString,
  narrationStyle: optionalString,
  emojiStyle: optionalString,
  avoidFormalHindi: z.boolean().optional().default(true),
  preferShortDialogues: z.boolean().optional().default(false),
  pacingHint: optionalString,
  avoid: stringList,
});

export const latestDraftSchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    wordCount: z.number().optional(),
    episodeNumber: z.number().optional(),
    clientRequestId: z.string().optional(),
    action: z.string().optional(),
    replaceEpisodeId: z.string().optional(),
  })
  .nullable()
  .optional();

export const storyMemorySchema = z.object({
  storyMemory: storyMemoryCoreSchema.default({
    genre: [],
    tone: [],
    themes: [],
    storyStatus: "brainstorming",
  }),
  characters: z.array(storyMemoryCharacterSchema).default([]),
  relationships: z.array(storyMemoryRelationshipSchema).default([]),
  writingRules: z.array(storyMemoryRuleSchema).default([]),
  userPreferences: userPreferencesSchema.default({
    uppercaseForLoudDialogue: false,
    slowBurn: false,
    doNotStartYet: false,
    mirrorUserLanguage: true,
    avoidFormalHindi: true,
    preferShortDialogues: false,
    avoid: [],
  }),
  latestDraft: latestDraftSchema.default(null),
  updatedAt: optionalString,
});

export type StoryMemory = z.infer<typeof storyMemorySchema>;
export type StoryMemoryCharacter = z.infer<typeof storyMemoryCharacterSchema>;
export type StoryMemoryRelationship = z.infer<
  typeof storyMemoryRelationshipSchema
>;

export const memoryRemoveSchema = z.object({
  type: z.enum(["character", "relationship", "rule", "preference_key"]),
  name: optionalString,
  from: optionalString,
  to: optionalString,
  rule: optionalString,
  key: optionalString,
});

export const memoryPatchSchema = z.object({
  story: storyMemoryCoreSchema.partial().default({}),
  characters: z.array(storyMemoryCharacterSchema).default([]),
  relationships: z.array(storyMemoryRelationshipSchema).default([]),
  writingRules: z.array(storyMemoryRuleSchema).default([]),
  preferences: userPreferencesSchema.partial().default({}),
  remove: z.array(memoryRemoveSchema).default([]),
});

export type MemoryPatch = z.infer<typeof memoryPatchSchema>;

export const agentSuggestionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(400),
});

export const storyAgentActionSchema = z.object({
  type: storyAgentActionTypeSchema.default("none"),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const emptyMemoryPatch = {
  story: {},
  characters: [] as Array<z.infer<typeof storyMemoryCharacterSchema>>,
  relationships: [] as Array<z.infer<typeof storyMemoryRelationshipSchema>>,
  writingRules: [] as Array<z.infer<typeof storyMemoryRuleSchema>>,
  preferences: {},
  remove: [] as Array<z.infer<typeof memoryRemoveSchema>>,
};

export const storyAgentTurnResultSchema = z.object({
  assistantReply: z.string().trim().min(1).max(8000),
  intent: storyAgentIntentSchema.default("chat"),
  requiresConfirmation: z.boolean().default(false),
  clarificationQuestion: z.preprocess((v) => {
    if (v == null) return null;
    const t = String(v).trim();
    return t.length > 0 ? t : null;
  }, z.string().nullable().default(null)),
  memoryPatch: memoryPatchSchema.default(emptyMemoryPatch),
  action: storyAgentActionSchema.default({ type: "none", payload: {} }),
  suggestions: z.array(agentSuggestionSchema).default([]),
});

export type StoryAgentTurnResult = z.infer<typeof storyAgentTurnResultSchema>;

export const INTERNAL_ACTIONS = [
  "update_story_memory",
  "show_story_review",
  "create_story_from_memory",
  "generate_episode_draft",
  "revise_episode_draft",
  "save_episode",
  "get_story_summary",
  "get_character_details",
  "suggest_story_options",
] as const;

export type InternalActionName = (typeof INTERNAL_ACTIONS)[number];
