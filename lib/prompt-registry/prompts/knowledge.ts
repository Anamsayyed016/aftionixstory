/**
 * Knowledge / Q&A prompts (Phase E).
 */

import {
  buildEmojiLayer,
  buildLanguageLayer,
  conflictPriorityPreamble,
  currentUserInstruction,
  joinLayers,
  platformIdentity,
  resolveEmojiLevel,
  serializeCharacterQuestionContext,
  serializeKnowledgeContext,
} from "@/lib/prompt-registry/layers";
import { composePromptResult } from "@/lib/prompt-registry/compose";
import type { PromptDefinition, PromptRequest } from "@/lib/prompt-registry/types";

function prefs(req: PromptRequest) {
  return (req.context.preferences || {}) as Record<string, unknown>;
}

function knowledgeBuilder(
  def: PromptDefinition,
  req: PromptRequest,
  focus: string,
  serializer: (ctx: PromptRequest["context"]) => string
) {
  const emoji = resolveEmojiLevel(prefs(req));
  const system = joinLayers([
    platformIdentity(),
    conflictPriorityPreamble(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer(emoji, "chat"),
    `KNOWLEDGE ANSWER RULES:
- Answer only from supplied context.
- Do not invent unavailable facts.
- If information is missing, say so clearly (e.g. you don't have enough saved details yet).
- Distinguish author knowledge from character knowledge.
- Be concise unless the user asks for detail.
- Do not output story prose unless requested.
- Focus: ${focus}`,
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializer(req.context),
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["story", "characters", "events", "knowledge"],
  });
}

function def(
  partial: Omit<PromptDefinition, "builder"> & {
    focus: string;
    serializer: (ctx: PromptRequest["context"]) => string;
  }
): PromptDefinition {
  const base: PromptDefinition = {
    ...partial,
    builder: (r) => knowledgeBuilder(base, r, partial.focus, partial.serializer),
  };
  return base;
}

export const knowledgePrompts: PromptDefinition[] = [
  def({
    id: "knowledge.story_question",
    version: "1.0.0",
    category: "knowledge",
    description: "Answer story-level questions from context.",
    supportedIntents: ["story_question", "search_story"],
    outputMode: "text",
    contextProfile: "story_question",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["story"],
    enabled: true,
    focus: "story overview / facts",
    serializer: serializeKnowledgeContext,
  }),
  def({
    id: "knowledge.character_question",
    version: "1.0.0",
    category: "knowledge",
    description: "Answer character questions from context.",
    supportedIntents: ["character_question"],
    outputMode: "text",
    contextProfile: "character_question",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["characters", "relationships"],
    enabled: true,
    focus: "character profile, relationships, major events",
    serializer: serializeCharacterQuestionContext,
  }),
  def({
    id: "knowledge.relationship_question",
    version: "1.0.0",
    category: "knowledge",
    description: "Answer relationship questions from context.",
    supportedIntents: ["relationship_question"],
    outputMode: "text",
    contextProfile: "relationship_question",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["relationships", "characters"],
    enabled: true,
    focus: "relationship status, history, conflicts",
    serializer: serializeKnowledgeContext,
  }),
  def({
    id: "knowledge.episode_question",
    version: "1.0.0",
    category: "knowledge",
    description: "Answer episode questions without fabricating episodes.",
    supportedIntents: ["episode_question"],
    outputMode: "text",
    contextProfile: "episode_question",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["events", "recentSummary"],
    enabled: true,
    focus:
      "episode-matched events/summary only — never fabricate missing episode facts",
    serializer: serializeKnowledgeContext,
  }),
  def({
    id: "knowledge.summary_story",
    version: "1.0.0",
    category: "knowledge",
    description: "Summarize the story from supplied context.",
    supportedIntents: ["summarize_story"],
    outputMode: "text",
    contextProfile: "summarize_story",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["story", "events"],
    enabled: true,
    focus: "concise story summary from known facts only",
    serializer: serializeKnowledgeContext,
  }),
  def({
    id: "knowledge.summary_episode",
    version: "1.0.0",
    category: "knowledge",
    description: "Summarize an episode from supplied context.",
    supportedIntents: ["summarize_episode"],
    outputMode: "text",
    contextProfile: "summarize_episode",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["events"],
    enabled: true,
    focus: "episode summary from known events only — no hallucination",
    serializer: serializeKnowledgeContext,
  }),
  def({
    id: "knowledge.search_answer",
    version: "1.0.0",
    category: "knowledge",
    description: "Answer search-like story questions from context.",
    supportedIntents: ["search_story"],
    outputMode: "text",
    contextProfile: "story_question",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["story", "events"],
    enabled: true,
    focus: "find relevant facts in provided context",
    serializer: serializeKnowledgeContext,
  }),
];
