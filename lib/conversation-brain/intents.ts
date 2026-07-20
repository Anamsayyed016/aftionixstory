/**
 * Canonical StoryVerse intents (Phase B) — single source of truth for create-chat.
 * Legacy BrainIntent values map here via adapters; do not duplicate enums elsewhere.
 */

import { z } from "zod";
import type { StoryOperation } from "@/lib/story-agent/operations";

export const STORY_INTENTS = [
  // conversation
  "greeting",
  "normal_chat",
  "help",
  "unknown",
  "general_question",
  // story exploration
  "brainstorm",
  "generate_plot",
  "generate_title",
  "generate_twist",
  "generate_ending",
  "world_building",
  // story entities
  "create_character",
  "update_character",
  "create_relationship",
  "update_relationship",
  "create_location",
  "update_location",
  // creative generation
  "write_scene",
  "write_episode",
  "continue_story",
  "generate_dialogue",
  "generate_description",
  // revision
  "rewrite",
  "revise_tone",
  "revise_style",
  "make_emotional",
  "make_romantic",
  "make_funny",
  "shorten",
  "expand",
  // story knowledge
  "story_question",
  "character_question",
  "episode_question",
  "relationship_question",
  "summarize_story",
  "summarize_episode",
  "search_story",
  // memory control
  "memory_update",
  "memory_correction",
  "memory_delete",
  // preferences
  "language_change",
  "style_change",
  "tone_change",
  "pacing_change",
  "pov_change",
  "emoji_preference",
  // control
  "block_generation",
  "unblock_generation",
  "retry",
  "cancel",
  // Phase A compatibility aliases exposed as first-class
  "offer_selection",
  "awaiting_answer",
] as const;

export type StoryIntent = (typeof STORY_INTENTS)[number];

export const storyIntentSchema = z.enum(STORY_INTENTS);

export type IntentSource =
  | "deterministic"
  | "contextual"
  | "llm"
  | "fallback"
  | "offer_resolver";

export const intentEntitiesSchema = z.object({
  characterNames: z.array(z.string()).default([]),
  episodeNumber: z.number().int().positive().nullable().default(null),
  requestedTone: z.string().nullable().default(null),
  requestedLanguage: z.string().nullable().default(null),
});

export type IntentEntities = z.infer<typeof intentEntitiesSchema>;

export const intentRouteResultSchema = z.object({
  intent: storyIntentSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum([
    "deterministic",
    "contextual",
    "llm",
    "fallback",
    "offer_resolver",
  ]),
  aiRequired: z.boolean(),
  creativeGeneration: z.boolean(),
  needsMemory: z.boolean(),
  needsDraft: z.boolean(),
  needsStorySearch: z.boolean(),
  needsClarification: z.boolean(),
  clarificationReason: z.string().nullable(),
  matchedSignals: z.array(z.string()).default([]),
  entities: intentEntitiesSchema.default({
    characterNames: [],
    episodeNumber: null,
    requestedTone: null,
    requestedLanguage: null,
  }),
  /** Internal only — never show in UI */
  classifierReason: z.string().nullable().optional(),
  overrideReason: z.string().nullable().optional(),
});

export type IntentRouteResult = z.infer<typeof intentRouteResultSchema>;

const CREATIVE = new Set<StoryIntent>([
  "write_scene",
  "write_episode",
  "continue_story",
  "generate_dialogue",
  "generate_description",
  "rewrite",
  "revise_tone",
  "revise_style",
  "make_emotional",
  "make_romantic",
  "make_funny",
  "shorten",
  "expand",
]);

/** Map canonical intent → existing StoryOperation for the executor. */
export function storyIntentToOperation(intent: StoryIntent): StoryOperation {
  switch (intent) {
    case "greeting":
    case "normal_chat":
    case "help":
    case "unknown":
    case "general_question":
    case "block_generation":
    case "unblock_generation":
    case "retry":
    case "cancel":
    case "offer_selection":
    case "awaiting_answer":
      return "conversational_chat";
    case "brainstorm":
    case "generate_plot":
    case "generate_title":
    case "generate_twist":
    case "generate_ending":
    case "world_building":
      return "brainstorm";
    case "create_character":
    case "update_character":
    case "create_relationship":
    case "update_relationship":
    case "create_location":
    case "update_location":
    case "memory_update":
    case "memory_correction":
    case "memory_delete":
    case "language_change":
    case "style_change":
    case "tone_change":
    case "pacing_change":
    case "pov_change":
    case "emoji_preference":
      return "memory_update";
    case "write_scene":
    case "generate_dialogue":
    case "generate_description":
      return "write_scene";
    case "write_episode":
      return "generate_episode";
    case "continue_story":
      return "continue_episode";
    case "rewrite":
    case "revise_tone":
    case "revise_style":
    case "make_emotional":
    case "make_romantic":
    case "make_funny":
    case "shorten":
    case "expand":
      return "revise_draft";
    case "story_question":
    case "character_question":
    case "episode_question":
    case "relationship_question":
    case "search_story":
      return "conversational_chat";
    case "summarize_story":
    case "summarize_episode":
      return "summarize";
    default:
      return "conversational_chat";
  }
}

export function isCreativeStoryIntent(intent: StoryIntent): boolean {
  return CREATIVE.has(intent);
}

/** Short definitions for the LLM classifier prompt. */
export const INTENT_DEFINITIONS: Record<StoryIntent, string> = {
  greeting: "User only greets or says hello",
  normal_chat: "Casual chat about the story without a specific action",
  help: "User asks how to use the assistant",
  unknown: "Cannot classify confidently",
  general_question: "General knowledge / writing craft question (no web search)",
  brainstorm: "Explore story concepts, pairings, options",
  generate_plot: "Ask for plot ideas",
  generate_title: "Ask for titles",
  generate_twist: "Ask for twists",
  generate_ending: "Ask for endings",
  world_building: "Build setting / world / lore",
  create_character: "Introduce a new character",
  update_character: "Add traits to an existing character",
  create_relationship: "Define a new relationship",
  update_relationship: "Change relationship details",
  create_location: "Add a place",
  update_location: "Update a place",
  write_scene: "Write a scene now",
  write_episode: "Write / start an episode",
  continue_story: "Continue draft or next episode",
  generate_dialogue: "Write dialogue only",
  generate_description: "Write descriptive prose",
  rewrite: "Rewrite existing draft prose",
  revise_tone: "Change tone of draft",
  revise_style: "Change writing style of draft",
  make_emotional: "Make draft more emotional",
  make_romantic: "Make draft more romantic",
  make_funny: "Make draft funnier",
  shorten: "Shorten draft",
  expand: "Expand draft",
  story_question: "Question about overall story",
  character_question: "Question about a character",
  episode_question: "Question about an episode",
  relationship_question: "Question about a relationship",
  summarize_story: "Summarize the whole story",
  summarize_episode: "Summarize an episode",
  search_story: "Search story facts",
  memory_update: "Store a new story fact",
  memory_correction: "Correct an existing fact",
  memory_delete: "Delete a remembered fact",
  language_change: "Change writing language",
  style_change: "Change style preferences",
  tone_change: "Change preferred tone (no draft)",
  pacing_change: "Change pacing preference",
  pov_change: "Change POV preference",
  emoji_preference: "Emoji preference for chat",
  block_generation: "Do not start writing yet",
  unblock_generation: "Allow writing again",
  retry: "Retry previous request",
  cancel: "Cancel current action",
  offer_selection: "Selecting a prior offer chip",
  awaiting_answer: "Answering a prior awaiting question",
};
