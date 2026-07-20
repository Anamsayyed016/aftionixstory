/**
 * Canonical Prompt IDs (Phase E).
 */

export const PROMPT_IDS = [
  // Conversation
  "conversation.greeting",
  "conversation.normal",
  "conversation.help",
  "conversation.clarification",
  "conversation.collaborative_brainstorm",
  "conversation.blocked_generation",
  "conversation.error_recovery",
  // Story exploration
  "story.brainstorm",
  "story.plot",
  "story.title",
  "story.twist",
  "story.ending",
  "story.world_building",
  // Characters / relationships
  "character.create",
  "character.update",
  "character.question",
  "relationship.create",
  "relationship.update",
  "relationship.question",
  // Creative
  "creative.scene",
  "creative.episode",
  "creative.continue",
  "creative.dialogue",
  "creative.description",
  // Revision
  "revision.rewrite",
  "revision.emotional",
  "revision.romantic",
  "revision.funny",
  "revision.tone",
  "revision.style",
  "revision.shorten",
  "revision.expand",
  // Knowledge
  "knowledge.story_question",
  "knowledge.episode_question",
  "knowledge.character_question",
  "knowledge.relationship_question",
  "knowledge.summary_story",
  "knowledge.summary_episode",
  "knowledge.search_answer",
  // Memory
  "memory.update",
  "memory.correction",
  "memory.delete_confirmation",
  // Preferences
  "preference.language",
  "preference.style",
  "preference.tone",
  "preference.pacing",
  "preference.pov",
  "preference.emoji",
  // Internal
  "internal.intent_classifier",
  "internal.memory_extraction",
  "internal.output_validation",
  "internal.response_review",
  // Phase G — Tool Framework
  "tool.plan",
] as const;

export type PromptId = (typeof PROMPT_IDS)[number];

export function isPromptId(value: string): value is PromptId {
  return (PROMPT_IDS as readonly string[]).includes(value);
}
