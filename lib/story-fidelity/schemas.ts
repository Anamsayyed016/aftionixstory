/**
 * ResolvedStoryFacts + validation contracts (Phase G.5).
 */

import { z } from "zod";

export const storyStatusFidelitySchema = z.enum([
  "planning",
  "ready",
  "writing",
  "paused",
]);

export const formatRulesSchema = z.object({
  uppercaseCharacterNames: z.boolean().default(false),
  emotionInBrackets: z.boolean().default(false),
  dialogueOnNextLine: z.boolean().default(false),
  sceneDivisions: z.boolean().default(false),
  episodeStructure: z.boolean().default(false),
  narrationStyle: z.string().nullable().default(null),
  emojiPolicy: z.enum(["none", "light", "expressive"]).nullable().default(null),
});

export const generationRulesSchema = z.object({
  slowBurn: z.boolean().nullable().default(null),
  pacing: z.string().nullable().default(null),
  pointOfView: z.string().nullable().default(null),
  forbiddenPatterns: z.array(z.string()).default([]),
  requiredElements: z.array(z.string()).default([]),
});

export const conversationRulesSchema = z.object({
  doNotStartStoryYet: z.boolean().default(false),
  allowSuggestions: z.boolean().default(true),
  maximumFollowUpQuestions: z.number().int().min(0).max(5).default(1),
  avoidRepeatedQuestions: z.boolean().default(true),
});

export const languageFactsSchema = z.object({
  responseLanguage: z.string().nullable().default(null),
  storyLanguage: z.string().nullable().default(null),
  dialogueLanguage: z.string().nullable().default(null),
});

export const characterFactsSchema = z.object({
  mainMaleLead: z.string().nullable().default(null),
  mainFemaleLead: z.string().nullable().default(null),
  confirmedCharacters: z.array(z.string()).default([]),
  aliases: z.record(z.string(), z.array(z.string())).default({}),
});

export const settingFactsSchema = z.object({
  primarySetting: z.string().nullable().default(null),
  secondarySettings: z.array(z.string()).default([]),
});

export const lockedFieldsSchema = z.array(z.string()).default([]);

export const resolvedStoryFactsSchema = z.object({
  storyStatus: storyStatusFidelitySchema.default("planning"),
  language: languageFactsSchema.default({
    responseLanguage: null,
    storyLanguage: null,
    dialogueLanguage: null,
  }),
  characters: characterFactsSchema.default({
    mainMaleLead: null,
    mainFemaleLead: null,
    confirmedCharacters: [],
    aliases: {},
  }),
  setting: settingFactsSchema.default({
    primarySetting: null,
    secondarySettings: [],
  }),
  genre: z.array(z.string()).default([]),
  tone: z.array(z.string()).default([]),
  relationshipDynamic: z.string().nullable().default(null),
  storyPremise: z.string().nullable().default(null),
  formatRules: formatRulesSchema.default({
    uppercaseCharacterNames: false,
    emotionInBrackets: false,
    dialogueOnNextLine: false,
    sceneDivisions: false,
    episodeStructure: false,
    narrationStyle: null,
    emojiPolicy: null,
  }),
  generationRules: generationRulesSchema.default({
    slowBurn: null,
    pacing: null,
    pointOfView: null,
    forbiddenPatterns: [],
    requiredElements: [],
  }),
  conversationRules: conversationRulesSchema.default({
    doNotStartStoryYet: false,
    allowSuggestions: true,
    maximumFollowUpQuestions: 1,
    avoidRepeatedQuestions: true,
  }),
  metadata: z
    .object({
      sourceTurnId: z.string().nullable().default(null),
      confirmedAt: z.string().nullable().default(null),
      updatedAt: z.string().nullable().default(null),
      confidence: z.number().min(0).max(1).default(0.8),
      lockedFields: lockedFieldsSchema,
    })
    .default({
      sourceTurnId: null,
      confirmedAt: null,
      updatedAt: null,
      confidence: 0.8,
      lockedFields: [],
    }),
});

export type ResolvedStoryFacts = z.infer<typeof resolvedStoryFactsSchema>;
export type FormatRules = z.infer<typeof formatRulesSchema>;

export const answeredQuestionSchema = z.object({
  key: z.string().min(1),
  answer: z.string().min(1),
  answeredAt: z.string(),
  source: z.enum(["user", "locked_fact", "memory"]).default("user"),
});

export type AnsweredQuestion = z.infer<typeof answeredQuestionSchema>;

export const QUESTION_KEYS = [
  "story_language",
  "primary_setting",
  "main_male_lead",
  "main_female_lead",
  "leads",
  "genre",
  "tone",
  "format_uppercase",
  "format_emotion",
  "format_dialogue",
  "format_scenes",
  "start_permission",
] as const;

export type QuestionKey = (typeof QUESTION_KEYS)[number];

export const storyReadinessResultSchema = z.object({
  ready: z.boolean(),
  mode: z.enum([
    "planning_only",
    "ready_to_write",
    "explicit_start",
    "continue",
    "rewrite",
    "blocked",
  ]),
  blockingReasons: z.array(z.string()).default([]),
  missingOptionalFacts: z.array(z.string()).default([]),
  generationAllowed: z.boolean(),
  resolvedFactsSnapshot: resolvedStoryFactsSchema.optional(),
});

export type StoryReadinessResult = z.infer<typeof storyReadinessResultSchema>;

export const storyGenerationContractSchema = z.object({
  operation: z.string(),
  requiredCharacters: z.array(
    z.object({
      name: z.string(),
      role: z.string().nullable().optional(),
      displayName: z.string().optional(),
    })
  ),
  requiredSetting: z.string().nullable(),
  requiredLanguage: z.string().nullable(),
  requiredFormat: z.object({
    characterNameCase: z.enum(["upper", "as_is"]).default("as_is"),
    emotionBracketFormat: z.boolean().default(false),
    dialoguePlacement: z.enum(["next_line", "inline", "any"]).default("any"),
    sceneDivision: z.boolean().default(false),
    episodeHeading: z.boolean().default(false),
  }),
  requiredContinuityFacts: z.array(z.string()).default([]),
  forbiddenSubstitutions: z.array(z.string()).default([]),
  latestInstruction: z.string(),
  storyStatus: storyStatusFidelitySchema,
  contractVersion: z.literal("1.0.0").default("1.0.0"),
});

export type StoryGenerationContract = z.infer<
  typeof storyGenerationContractSchema
>;

export const validationViolationSchema = z.object({
  code: z.string(),
  category: z.enum([
    "character",
    "setting",
    "language",
    "format",
    "instruction",
    "generic_fallback",
  ]),
  message: z.string(),
  repairable: z.boolean().default(true),
});

export const storyValidationResultSchema = z.object({
  valid: z.boolean(),
  score: z.number().min(0).max(1),
  violations: z.array(validationViolationSchema).default([]),
  warnings: z.array(z.string()).default([]),
  repairable: z.boolean(),
  metrics: z.record(z.string(), z.number()).default({}),
});

export type StoryValidationResult = z.infer<typeof storyValidationResultSchema>;

export const instructionFidelityStateSchema = z.object({
  resolvedFacts: resolvedStoryFactsSchema,
  answeredQuestions: z.array(answeredQuestionSchema).default([]),
  lastContractMeta: z
    .object({
      operation: z.string().optional(),
      requiredCharacterCount: z.number().optional(),
      requiredSetting: z.string().nullable().optional(),
      requiredLanguage: z.string().nullable().optional(),
      updatedAt: z.string().optional(),
    })
    .nullable()
    .default(null),
  lastValidationSummary: z
    .object({
      valid: z.boolean(),
      score: z.number(),
      violationCodes: z.array(z.string()).default([]),
      repairAttempted: z.boolean().default(false),
      updatedAt: z.string().optional(),
    })
    .nullable()
    .default(null),
});

export type InstructionFidelityState = z.infer<
  typeof instructionFidelityStateSchema
>;

export const SAFE_GENERATION_FAILURE_MESSAGE =
  "I couldn’t generate this episode while preserving your confirmed characters and format. Please try once more.";
