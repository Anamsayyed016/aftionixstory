/**
 * Operation context profiles (Phase D).
 */

import type { ContextLimits } from "@/lib/context-builder/v2/schema";
import { DEFAULT_CONTEXT_LIMITS } from "@/lib/context-builder/v2/schema";
import type { StoryIntent } from "@/lib/conversation-brain/intents";

export type ContextSection =
  | "story"
  | "characters"
  | "relationships"
  | "locations"
  | "objects"
  | "events"
  | "timeline"
  | "openThreads"
  | "secrets"
  | "promises"
  | "worldRules"
  | "writingRules"
  | "preferences"
  | "continuity"
  | "recentConversation"
  | "latestDraft"
  | "recentSummary"
  | "knowledge"
  | "instructionContract";

export type OperationProfile = {
  id: string;
  required: ContextSection[];
  optional: ContextSection[];
  includeLatestDraft: boolean;
  includeRecentSummary: boolean;
  includeRecentMessages: boolean;
  preferDraftEnding: boolean;
  authorSecretsOk: boolean;
  limits: Partial<ContextLimits>;
};

const minimalChat: OperationProfile = {
  id: "normal_chat",
  required: ["preferences", "recentConversation"],
  optional: ["story", "continuity"],
  includeLatestDraft: false,
  includeRecentSummary: false,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: {
    maxCharacters: 0,
    maxRelationships: 0,
    maxEvents: 0,
    maxOpenThreads: 0,
    maxWritingRules: 4,
    maxRecentMessages: 6,
    maxTotalEstimatedTokens: 1500,
  },
};

const creativeScene: OperationProfile = {
  id: "write_scene",
  required: [
    "instructionContract",
    "story",
    "characters",
    "relationships",
    "writingRules",
    "preferences",
    "continuity",
  ],
  optional: [
    "locations",
    "events",
    "openThreads",
    "secrets",
    "promises",
    "recentConversation",
    "knowledge",
  ],
  includeLatestDraft: false,
  includeRecentSummary: true,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: { ...DEFAULT_CONTEXT_LIMITS },
};

const reviseDraft: OperationProfile = {
  id: "rewrite",
  required: [
    "story",
    "characters",
    "writingRules",
    "preferences",
    "continuity",
    "latestDraft",
  ],
  optional: ["relationships", "locations", "events", "recentConversation"],
  includeLatestDraft: true,
  includeRecentSummary: false,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: { maxDraftChars: 12_000, maxCharacters: 6, maxEvents: 4 },
};

const continueStory: OperationProfile = {
  id: "continue_story",
  required: [
    "story",
    "characters",
    "relationships",
    "continuity",
    "writingRules",
    "preferences",
    "latestDraft",
  ],
  optional: ["locations", "events", "openThreads", "promises", "recentConversation"],
  includeLatestDraft: true,
  includeRecentSummary: true,
  includeRecentMessages: true,
  preferDraftEnding: true,
  authorSecretsOk: false,
  limits: { maxDraftChars: 12_000 },
};

const characterQuestion: OperationProfile = {
  id: "character_question",
  required: ["characters", "relationships", "preferences"],
  optional: ["events", "secrets", "recentSummary", "story", "openThreads"],
  includeLatestDraft: false,
  includeRecentSummary: true,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: {
    maxCharacters: 3,
    maxRelationships: 8,
    maxEvents: 6,
    maxDraftChars: 0,
  },
};

const languageChange: OperationProfile = {
  id: "language_change",
  required: ["preferences", "writingRules"],
  optional: ["recentConversation"],
  includeLatestDraft: false,
  includeRecentSummary: false,
  includeRecentMessages: false,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: {
    maxCharacters: 0,
    maxRelationships: 0,
    maxEvents: 0,
    maxWritingRules: 8,
    maxRecentMessages: 2,
    maxTotalEstimatedTokens: 800,
  },
};

const memoryCorrection: OperationProfile = {
  id: "memory_correction",
  required: ["characters", "relationships", "preferences"],
  optional: ["recentConversation"],
  includeLatestDraft: false,
  includeRecentSummary: false,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: {
    maxCharacters: 4,
    maxRelationships: 6,
    maxEvents: 0,
    maxOpenThreads: 0,
    maxWritingRules: 2,
    maxRecentMessages: 4,
    maxTotalEstimatedTokens: 1200,
  },
};

const brainstorm: OperationProfile = {
  id: "brainstorm",
  required: ["story", "preferences", "recentConversation"],
  optional: ["characters", "writingRules", "continuity", "secrets", "knowledge"],
  includeLatestDraft: false,
  includeRecentSummary: false,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: true,
  limits: {
    maxCharacters: 4,
    maxRelationships: 4,
    maxEvents: 0,
    maxWritingRules: 8,
    maxRecentMessages: 8,
    maxSecrets: 4,
  },
};

const episodeQuestion: OperationProfile = {
  id: "episode_question",
  required: ["events", "preferences", "story"],
  optional: ["characters", "timeline", "recentSummary"],
  includeLatestDraft: false,
  includeRecentSummary: true,
  includeRecentMessages: true,
  preferDraftEnding: false,
  authorSecretsOk: false,
  limits: { maxEvents: 12, maxCharacters: 6, maxDraftChars: 0 },
};

const PROFILES: Record<string, OperationProfile> = {
  greeting: { ...minimalChat, id: "greeting", includeRecentMessages: false, limits: { ...minimalChat.limits, maxRecentMessages: 0 } },
  normal_chat: minimalChat,
  help: minimalChat,
  unknown: minimalChat,
  general_question: minimalChat,
  brainstorm,
  generate_plot: brainstorm,
  generate_title: brainstorm,
  generate_twist: {
    ...brainstorm,
    id: "generate_twist",
    optional: [...brainstorm.optional, "openThreads", "events"],
  },
  generate_ending: {
    ...creativeScene,
    id: "generate_ending",
    includeLatestDraft: true,
  },
  world_building: {
    id: "world_building",
    required: ["story", "preferences", "worldRules"],
    optional: ["locations", "writingRules", "characters", "recentConversation"],
    includeLatestDraft: false,
    includeRecentSummary: false,
    includeRecentMessages: true,
    preferDraftEnding: false,
    authorSecretsOk: true,
    limits: { maxLocations: 8, maxCharacters: 4, maxEvents: 0 },
  },
  create_character: {
    id: "create_character",
    required: ["characters", "preferences", "story"],
    optional: ["relationships", "writingRules", "recentConversation"],
    includeLatestDraft: false,
    includeRecentSummary: false,
    includeRecentMessages: true,
    preferDraftEnding: false,
    authorSecretsOk: false,
    limits: { maxCharacters: 6, maxRelationships: 6 },
  },
  update_character: {
    id: "update_character",
    required: ["characters", "preferences"],
    optional: ["relationships", "recentConversation"],
    includeLatestDraft: false,
    includeRecentSummary: false,
    includeRecentMessages: true,
    preferDraftEnding: false,
    authorSecretsOk: false,
    limits: { maxCharacters: 4, maxRelationships: 6 },
  },
  create_relationship: memoryCorrection,
  update_relationship: memoryCorrection,
  write_scene: creativeScene,
  write_episode: {
    ...creativeScene,
    id: "write_episode",
    optional: [...creativeScene.optional, "timeline"],
    includeRecentSummary: true,
  },
  continue_story: continueStory,
  generate_dialogue: {
    ...reviseDraft,
    id: "generate_dialogue",
    includeLatestDraft: true,
  },
  generate_description: {
    ...creativeScene,
    id: "generate_description",
    includeLatestDraft: false,
  },
  rewrite: reviseDraft,
  revise_tone: reviseDraft,
  revise_style: reviseDraft,
  make_emotional: reviseDraft,
  make_romantic: reviseDraft,
  make_funny: reviseDraft,
  shorten: reviseDraft,
  expand: reviseDraft,
  story_question: {
    id: "story_question",
    required: ["story", "preferences"],
    optional: ["characters", "events", "openThreads", "recentSummary"],
    includeLatestDraft: false,
    includeRecentSummary: true,
    includeRecentMessages: true,
    preferDraftEnding: false,
    authorSecretsOk: false,
    limits: { maxCharacters: 6, maxEvents: 8, maxDraftChars: 0 },
  },
  character_question: characterQuestion,
  relationship_question: {
    ...characterQuestion,
    id: "relationship_question",
    required: ["characters", "relationships", "preferences"],
  },
  episode_question: episodeQuestion,
  summarize_story: {
    id: "summarize_story",
    required: ["story", "characters", "events", "preferences"],
    optional: ["relationships", "openThreads", "timeline", "recentSummary"],
    includeLatestDraft: false,
    includeRecentSummary: true,
    includeRecentMessages: false,
    preferDraftEnding: false,
    authorSecretsOk: false,
    limits: { maxCharacters: 10, maxEvents: 15, maxWritingRules: 4 },
  },
  summarize_episode: episodeQuestion,
  search_story: {
    id: "search_story",
    required: ["story", "preferences"],
    optional: ["characters", "events", "locations", "recentSummary"],
    includeLatestDraft: false,
    includeRecentSummary: true,
    includeRecentMessages: true,
    preferDraftEnding: false,
    authorSecretsOk: false,
    limits: { maxDraftChars: 0 },
  },
  memory_update: {
    id: "memory_update",
    required: ["characters", "preferences", "story"],
    optional: ["relationships", "recentConversation"],
    includeLatestDraft: false,
    includeRecentSummary: false,
    includeRecentMessages: true,
    preferDraftEnding: false,
    authorSecretsOk: false,
    limits: { maxCharacters: 6, maxRelationships: 6, maxEvents: 0 },
  },
  memory_correction: memoryCorrection,
  memory_delete: memoryCorrection,
  language_change: languageChange,
  style_change: languageChange,
  tone_change: languageChange,
  pacing_change: languageChange,
  pov_change: languageChange,
  emoji_preference: languageChange,
  block_generation: minimalChat,
  unblock_generation: minimalChat,
  retry: minimalChat,
  cancel: minimalChat,
  offer_selection: {
    ...brainstorm,
    id: "offer_selection",
    required: ["story", "preferences", "recentConversation", "characters"],
  },
  awaiting_answer: {
    ...brainstorm,
    id: "awaiting_answer",
    required: ["story", "preferences", "recentConversation"],
  },
};

export function resolveOperationProfile(
  intent: string | undefined | null,
  operation?: string | null
): OperationProfile {
  if (intent && PROFILES[intent]) return PROFILES[intent];
  // Map common StoryOperations
  const op = (operation || "").toLowerCase();
  if (op.includes("write_scene")) return PROFILES.write_scene;
  if (op.includes("continue")) return PROFILES.continue_story;
  if (op.includes("revise")) return PROFILES.rewrite;
  if (op.includes("brainstorm") || op.includes("suggest")) return PROFILES.brainstorm;
  if (op.includes("episode") || op.includes("start_story")) return PROFILES.write_episode;
  if (op.includes("summarize")) return PROFILES.summarize_story;
  if (op.includes("memory")) return PROFILES.memory_update;
  return PROFILES.normal_chat;
}

export function mergeLimits(
  base: ContextLimits,
  profile: OperationProfile,
  override?: Partial<ContextLimits>
): ContextLimits {
  return {
    ...base,
    ...profile.limits,
    ...override,
  };
}

export type { StoryIntent };
