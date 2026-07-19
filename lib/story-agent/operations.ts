/**
 * Operation types for Story Agent routing.
 * Each operation has its own prompt, model profile, and response contract.
 */
export const STORY_OPERATIONS = [
  "conversational_chat",
  "brainstorm",
  "memory_update",
  "inspect_memory",
  "suggest_options",
  "write_scene",
  "start_story",
  "generate_episode",
  "continue_episode",
  "revise_draft",
  "summarize",
  "create_story",
  "save_episode",
  "show_story_details",
] as const;

export type StoryOperation = (typeof STORY_OPERATIONS)[number];

export type OutputMode = "structured" | "text";

export type ModelProfile = "agent" | "creative" | "summary";

export type OperationProfile = {
  operation: StoryOperation;
  outputMode: OutputMode;
  modelProfile: ModelProfile;
  maxOutputTokens: number;
  temperature: number;
};

export const OPERATION_PROFILES: Record<StoryOperation, OperationProfile> = {
  conversational_chat: {
    operation: "conversational_chat",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 1200,
    temperature: 0.7,
  },
  brainstorm: {
    operation: "brainstorm",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 1400,
    temperature: 0.8,
  },
  memory_update: {
    operation: "memory_update",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 1000,
    temperature: 0.3,
  },
  inspect_memory: {
    operation: "inspect_memory",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 1000,
    temperature: 0.4,
  },
  suggest_options: {
    operation: "suggest_options",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 1200,
    temperature: 0.8,
  },
  write_scene: {
    operation: "write_scene",
    outputMode: "text",
    modelProfile: "creative",
    maxOutputTokens: 4096,
    temperature: 0.85,
  },
  start_story: {
    operation: "start_story",
    outputMode: "text",
    modelProfile: "creative",
    maxOutputTokens: 4096,
    temperature: 0.85,
  },
  generate_episode: {
    operation: "generate_episode",
    outputMode: "text",
    modelProfile: "creative",
    maxOutputTokens: 4096,
    temperature: 0.85,
  },
  continue_episode: {
    operation: "continue_episode",
    outputMode: "text",
    modelProfile: "creative",
    maxOutputTokens: 4096,
    temperature: 0.85,
  },
  revise_draft: {
    operation: "revise_draft",
    outputMode: "text",
    modelProfile: "creative",
    maxOutputTokens: 4096,
    temperature: 0.8,
  },
  summarize: {
    operation: "summarize",
    outputMode: "text",
    modelProfile: "summary",
    maxOutputTokens: 800,
    temperature: 0.4,
  },
  create_story: {
    operation: "create_story",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 800,
    temperature: 0.3,
  },
  save_episode: {
    operation: "save_episode",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 400,
    temperature: 0.2,
  },
  show_story_details: {
    operation: "show_story_details",
    outputMode: "structured",
    modelProfile: "agent",
    maxOutputTokens: 800,
    temperature: 0.4,
  },
};

export function isCreativeOperation(op: StoryOperation): boolean {
  return OPERATION_PROFILES[op].outputMode === "text" && op !== "summarize";
}
