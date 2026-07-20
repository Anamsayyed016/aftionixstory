/**
 * Intent / operation → promptId mapping (Phase E).
 * Single authoritative map — do not scatter across planner/executor.
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type { PromptId } from "@/lib/prompt-registry/ids";

export type ResolvePromptIdInput = {
  intent?: string | null;
  operation?: string | null;
  conversationFlow?: ConversationFlow | null;
  /** Phase A collaborative brainstorm path */
  collaborationMode?: boolean;
  /** Brain clarification turn */
  needsClarification?: boolean;
  /** Creative write while blocked */
  generationBlocked?: boolean;
};

const INTENT_TO_PROMPT: Record<string, PromptId> = {
  greeting: "conversation.greeting",
  help: "conversation.help",
  normal_chat: "conversation.normal",
  unknown: "conversation.normal",
  general_question: "conversation.normal",
  offer_selection: "conversation.normal",
  awaiting_answer: "conversation.normal",
  retry: "conversation.error_recovery",
  cancel: "conversation.normal",
  block_generation: "conversation.blocked_generation",
  unblock_generation: "conversation.normal",

  brainstorm: "conversation.collaborative_brainstorm",
  generate_plot: "story.plot",
  generate_title: "story.title",
  generate_twist: "story.twist",
  generate_ending: "story.ending",
  world_building: "story.world_building",

  create_character: "character.create",
  update_character: "character.update",
  character_question: "knowledge.character_question",
  create_relationship: "relationship.create",
  update_relationship: "relationship.update",
  relationship_question: "knowledge.relationship_question",
  create_location: "memory.update",
  update_location: "memory.update",

  write_scene: "creative.scene",
  write_episode: "creative.episode",
  continue_story: "creative.continue",
  generate_dialogue: "creative.dialogue",
  generate_description: "creative.description",

  rewrite: "revision.rewrite",
  make_emotional: "revision.emotional",
  make_romantic: "revision.romantic",
  make_funny: "revision.funny",
  revise_tone: "revision.tone",
  revise_style: "revision.style",
  shorten: "revision.shorten",
  expand: "revision.expand",

  story_question: "knowledge.story_question",
  episode_question: "knowledge.episode_question",
  summarize_story: "knowledge.summary_story",
  summarize_episode: "knowledge.summary_episode",
  search_story: "knowledge.search_answer",

  memory_update: "memory.update",
  memory_correction: "memory.correction",
  memory_delete: "memory.delete_confirmation",

  language_change: "preference.language",
  style_change: "preference.style",
  tone_change: "preference.tone",
  pacing_change: "preference.pacing",
  pov_change: "preference.pov",
  emoji_preference: "preference.emoji",
};

const OPERATION_TO_PROMPT: Record<string, PromptId> = {
  conversational_chat: "conversation.normal",
  brainstorm: "story.brainstorm",
  suggest_options: "story.brainstorm",
  memory_update: "memory.update",
  write_scene: "creative.scene",
  generate_episode: "creative.episode",
  continue_episode: "creative.continue",
  revise_draft: "revision.rewrite",
  summarize: "knowledge.summary_story",
  phase_a_collaborative: "conversation.collaborative_brainstorm",
  intent_classifier: "internal.intent_classifier",
};

/**
 * Resolve canonical prompt ID for a turn.
 */
export function resolvePromptId(input: ResolvePromptIdInput): PromptId {
  const blocked =
    input.generationBlocked ??
    input.conversationFlow?.generationBlocked ??
    false;

  if (blocked) {
    const intent = input.intent || "";
    const creative =
      intent.startsWith("write_") ||
      intent.startsWith("generate_") ||
      intent === "continue_story" ||
      intent === "rewrite" ||
      intent.startsWith("make_") ||
      intent.startsWith("revise_") ||
      intent === "shorten" ||
      intent === "expand" ||
      input.operation === "write_scene" ||
      input.operation === "generate_episode" ||
      input.operation === "continue_episode" ||
      input.operation === "revise_draft";
    if (creative || intent === "block_generation") {
      return "conversation.blocked_generation";
    }
  }

  if (input.needsClarification) {
    return "conversation.clarification";
  }

  if (input.collaborationMode && (input.intent === "brainstorm" || input.operation === "brainstorm")) {
    return "conversation.collaborative_brainstorm";
  }

  if (input.intent && INTENT_TO_PROMPT[input.intent]) {
    return INTENT_TO_PROMPT[input.intent];
  }

  if (input.operation && OPERATION_TO_PROMPT[input.operation]) {
    return OPERATION_TO_PROMPT[input.operation];
  }

  return "conversation.normal";
}

export function listIntentPromptMappings(): Array<{
  intent: string;
  promptId: PromptId;
}> {
  return Object.entries(INTENT_TO_PROMPT).map(([intent, promptId]) => ({
    intent,
    promptId,
  }));
}

export { INTENT_TO_PROMPT, OPERATION_TO_PROMPT };
