/**
 * Story exploration + internal prompts (Phase E).
 */

import {
  antiWizardRules,
  buildEmojiLayer,
  buildLanguageLayer,
  conflictPriorityPreamble,
  conversationBehavior,
  currentUserInstruction,
  joinLayers,
  platformIdentity,
  resolveEmojiLevel,
  serializeDynamicContextForPrompt,
} from "@/lib/prompt-registry/layers";
import { composePromptResult } from "@/lib/prompt-registry/compose";
import type { PromptDefinition, PromptRequest } from "@/lib/prompt-registry/types";
import {
  INTENT_DEFINITIONS,
  STORY_INTENTS,
  type StoryIntent,
} from "@/lib/conversation-brain/intents";
import { knowledgePrompts } from "@/lib/prompt-registry/prompts/knowledge";
import { isStoryToolFrameworkEnabled } from "@/lib/tools/feature-flag";
import { TOOL_IDS } from "@/lib/tools/schemas";

function prefs(req: PromptRequest) {
  return (req.context.preferences || {}) as Record<string, unknown>;
}

function storyBrainstormBuilder(def: PromptDefinition, req: PromptRequest) {
  const emoji = resolveEmojiLevel(prefs(req));
  const system = joinLayers([
    platformIdentity(),
    antiWizardRules(),
    conversationBehavior({ emojiLine: buildEmojiLayer(emoji, "chat") }),
    buildLanguageLayer(prefs(req)),
    conflictPriorityPreamble(),
    `BRAINSTORM:
- Accept incomplete concepts.
- Build on existing memory.
- Give useful, non-generic options.
- Avoid repeating previous offers.
- Do not start writing the story.
- Ask at most one follow-up question.
Return JSON decision envelope with assistantReply, intent "brainstorm",
action.type "suggest_options", and 2–4 suggestion chips. No markdown fences.`,
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeDynamicContextForPrompt({
      ...req.context,
      latestDraft: null,
      events: [],
    }),
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["story", "characters", "preferences"],
    outputMode: "json",
  });
}

function storyFocusBuilder(
  def: PromptDefinition,
  req: PromptRequest,
  focus: string
) {
  const emoji = resolveEmojiLevel(prefs(req));
  const system = joinLayers([
    platformIdentity(),
    antiWizardRules(),
    conversationBehavior({ emojiLine: buildEmojiLayer(emoji, "chat") }),
    buildLanguageLayer(prefs(req)),
    `Focus on ${focus}. Do not write full scenes unless asked. Plain text or structured suggestions as appropriate — prefer JSON envelope with assistantReply + offers (max 4).`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user: joinLayers([
      currentUserInstruction(req.userMessage),
      serializeDynamicContextForPrompt({
        ...req.context,
        latestDraft: null,
      }),
    ]),
    includedSections: ["story", "preferences"],
    outputMode: "json",
  });
}

function characterEntityBuilder(
  def: PromptDefinition,
  req: PromptRequest,
  mode: "create" | "update"
) {
  const toolMode = isStoryToolFrameworkEnabled();
  const system = joinLayers([
    platformIdentity(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "json"),
    toolMode
      ? `CHARACTER ${mode.toUpperCase()} (TOOL FRAMEWORK):
- Do NOT emit memoryPatch.
- Emit ToolRequest JSON only:
{"toolRequests":[{"toolId":"character.${mode === "create" ? "create" : "update"}","arguments":{...},"reason":"...","confidence":0.9}],"assistantReply":"short ack"}
- For renames use toolId "character.rename" with oldName + newName.
- Never write story prose.
- JSON only.`
      : `CHARACTER ${mode.toUpperCase()}:
- Capture explicit character facts into memoryPatch.
- Acknowledge in assistantReply.
- Do not write story prose.
- JSON only.`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user: joinLayers([
      currentUserInstruction(req.userMessage),
      serializeDynamicContextForPrompt({
        ...req.context,
        latestDraft: null,
        events: [],
      }),
    ]),
    includedSections: ["characters", "relationships"],
    outputMode: "json",
  });
}

function relationshipEntityBuilder(
  def: PromptDefinition,
  req: PromptRequest,
  mode: "create" | "update"
) {
  const toolMode = isStoryToolFrameworkEnabled();
  const system = joinLayers([
    platformIdentity(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "json"),
    toolMode
      ? `RELATIONSHIP ${mode.toUpperCase()} (TOOL FRAMEWORK):
- Do NOT emit memoryPatch.
- Emit ToolRequest JSON:
{"toolRequests":[{"toolId":"relationship.${mode}","arguments":{"fromName":"...","toName":"...","type":"..."},"reason":"...","confidence":0.9}],"assistantReply":"short ack"}
- Never write story prose.
- JSON only.`
      : `RELATIONSHIP ${mode.toUpperCase()}:
- Capture explicit relationship facts into memoryPatch.
- Acknowledge in assistantReply.
- Do not write story prose.
- JSON only.`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user: joinLayers([
      currentUserInstruction(req.userMessage),
      serializeDynamicContextForPrompt({
        ...req.context,
        latestDraft: null,
      }),
    ]),
    includedSections: ["characters", "relationships"],
    outputMode: "json",
  });
}

function toolPlanBuilder(def: PromptDefinition, req: PromptRequest) {
  const catalog = TOOL_IDS.join(", ");
  const system = joinLayers([
    platformIdentity(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "json"),
    `TOOL PLANNER (Phase G):
Providers never execute tools and never mutate memory.
Plan one or more ToolRequests from the user message.
Allowed toolIds: ${catalog}
Return JSON only:
{"toolRequests":[{"toolId":"...","arguments":{},"reason":"...","confidence":0.0}],"assistantReply":"short natural acknowledgment"}
Rules:
- Prefer the smallest correct tool set.
- Never invent character ids — use names when unsure.
- Never write story prose.
- Never emit memoryPatch.`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user: joinLayers([
      currentUserInstruction(req.userMessage),
      serializeDynamicContextForPrompt({
        ...req.context,
        latestDraft: null,
        events: req.context.events.slice(0, 4),
      }),
    ]),
    includedSections: ["characters", "relationships", "preferences"],
    outputMode: "json",
  });
}

const CLASSIFIER_INTENTS: StoryIntent[] = STORY_INTENTS.filter(
  (i) => i !== "offer_selection" && i !== "awaiting_answer"
);

function intentClassifierBuilder(def: PromptDefinition, req: PromptRequest) {
  const defs = CLASSIFIER_INTENTS.map(
    (i) => `- ${i}: ${INTENT_DEFINITIONS[i]}`
  ).join("\n");
  const system = joinLayers([
    `You are an intent classifier for a storytelling assistant.
Classify the user message into exactly ONE allowed intent.
Never answer the user. Never write story prose.
Output valid JSON only.
If uncertain, use intent "unknown" with low confidence.
Do not invent character names not present in the message or context.
Distinguish corrections from updates, preference changes from prose requests, and draft revisions from new generation.

Allowed intents:
${defs}`,
  ]);
  const user = joinLayers([
    `USER MESSAGE:\n${req.userMessage.slice(0, 500)}`,
    req.metadata?.intentContextSummary
      ? `INTENT CONTEXT (compact):\n${req.metadata.intentContextSummary}`
      : "",
    `Return JSON:
{
  "intent": "<one allowed intent>",
  "confidence": 0.0,
  "entities": {
    "characterNames": [],
    "episodeNumber": null,
    "requestedTone": null,
    "requestedLanguage": null
  },
  "reason": "short internal reason"
}`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: [],
    outputMode: "json",
  });
}

function stub(
  id: PromptDefinition["id"],
  description: string
): PromptDefinition {
  return {
    id,
    version: "0.0.0",
    category: "internal",
    description,
    supportedIntents: [],
    outputMode: "json",
    contextProfile: "normal_chat",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "short",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: [],
    enabled: false,
    builder: () => {
      throw new Error(`Prompt stub disabled: ${id}`);
    },
  };
}

function mkStory(
  id: PromptDefinition["id"],
  intents: string[],
  focus: string,
  description: string
): PromptDefinition {
  const base: PromptDefinition = {
    id,
    version: "1.0.0",
    category: "story",
    description,
    supportedIntents: intents,
    outputMode: "json",
    contextProfile: "brainstorm",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["story", "preferences"],
    enabled: true,
    builder: (r) => storyFocusBuilder(base, r, focus),
  };
  return base;
}

export const storyPrompts: PromptDefinition[] = [
  {
    id: "story.brainstorm",
    version: "1.0.0",
    category: "story",
    description: "Structured brainstorm (non-Phase-A path).",
    supportedIntents: ["brainstorm"],
    outputMode: "json",
    contextProfile: "brainstorm",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["story", "preferences"],
    enabled: true,
    builder: (req) =>
      storyBrainstormBuilder(
        storyPrompts.find((p) => p.id === "story.brainstorm")!,
        req
      ),
  },
  mkStory("story.plot", ["generate_plot"], "plot directions", "Plot brainstorm"),
  mkStory("story.title", ["generate_title"], "title options", "Title brainstorm"),
  mkStory("story.twist", ["generate_twist"], "twist ideas", "Twist brainstorm"),
  mkStory(
    "story.ending",
    ["generate_ending"],
    "ending directions",
    "Ending brainstorm"
  ),
  mkStory(
    "story.world_building",
    ["world_building"],
    "world/setting details",
    "World building brainstorm"
  ),
];

export const characterPrompts: PromptDefinition[] = [
  {
    id: "character.create",
    version: "1.0.0",
    category: "character",
    description: "Create character via memory patch JSON.",
    supportedIntents: ["create_character"],
    outputMode: "json",
    contextProfile: "create_character",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["characters"],
    enabled: true,
    builder: (req) =>
      characterEntityBuilder(
        characterPrompts.find((p) => p.id === "character.create")!,
        req,
        "create"
      ),
  },
  {
    id: "character.update",
    version: "1.0.0",
    category: "character",
    description: "Update character via memory patch JSON.",
    supportedIntents: ["update_character"],
    outputMode: "json",
    contextProfile: "update_character",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["characters"],
    enabled: true,
    builder: (req) =>
      characterEntityBuilder(
        characterPrompts.find((p) => p.id === "character.update")!,
        req,
        "update"
      ),
  },
  {
    id: "character.question",
    version: "1.0.0",
    category: "character",
    description: "Alias routing to knowledge.character_question.",
    supportedIntents: ["character_question"],
    outputMode: "text",
    contextProfile: "character_question",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["characters"],
    enabled: true,
    builder: (req) => {
      const k = knowledgePrompts.find((p) => p.id === "knowledge.character_question")!;
      const result = k.builder({ ...req, promptId: "knowledge.character_question" });
      return { ...result, promptId: "character.question", promptVersion: "1.0.0" };
    },
  },
];

export const relationshipPrompts: PromptDefinition[] = [
  {
    id: "relationship.create",
    version: "1.0.0",
    category: "relationship",
    description: "Create relationship via memory patch JSON.",
    supportedIntents: ["create_relationship"],
    outputMode: "json",
    contextProfile: "create_relationship",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["relationships"],
    enabled: true,
    builder: (req) =>
      relationshipEntityBuilder(
        relationshipPrompts.find((p) => p.id === "relationship.create")!,
        req,
        "create"
      ),
  },
  {
    id: "relationship.update",
    version: "1.0.0",
    category: "relationship",
    description: "Update relationship via memory patch JSON.",
    supportedIntents: ["update_relationship"],
    outputMode: "json",
    contextProfile: "update_relationship",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["relationships"],
    enabled: true,
    builder: (req) =>
      relationshipEntityBuilder(
        relationshipPrompts.find((p) => p.id === "relationship.update")!,
        req,
        "update"
      ),
  },
  {
    id: "relationship.question",
    version: "1.0.0",
    category: "relationship",
    description: "Alias to knowledge.relationship_question.",
    supportedIntents: ["relationship_question"],
    outputMode: "text",
    contextProfile: "relationship_question",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["relationships"],
    enabled: true,
    builder: (req) => {
      const k = knowledgePrompts.find(
        (p) => p.id === "knowledge.relationship_question"
      )!;
      const result = k.builder({
        ...req,
        promptId: "knowledge.relationship_question",
      });
      return {
        ...result,
        promptId: "relationship.question",
        promptVersion: "1.0.0",
      };
    },
  },
];

export const internalPrompts: PromptDefinition[] = [
  {
    id: "internal.intent_classifier",
    version: "1.0.0",
    category: "internal",
    description: "Phase B intent classifier (JSON only).",
    supportedIntents: [],
    outputMode: "json",
    contextProfile: "normal_chat",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "short",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: [],
    enabled: true,
    builder: (req) =>
      intentClassifierBuilder(
        internalPrompts.find((p) => p.id === "internal.intent_classifier")!,
        req
      ),
  },
  {
    id: "tool.plan",
    version: "1.0.0",
    category: "internal",
    description: "Phase G tool planner — emits ToolRequest JSON only.",
    supportedIntents: [
      "create_character",
      "update_character",
      "create_relationship",
      "update_relationship",
      "memory_update",
      "memory_correction",
      "language_change",
      "style_change",
      "tone_change",
      "pacing_change",
    ],
    outputMode: "json",
    contextProfile: "memory_update",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["characters", "relationships"],
    enabled: true,
    builder: (req) =>
      toolPlanBuilder(internalPrompts.find((p) => p.id === "tool.plan")!, req),
  },
  stub("internal.memory_extraction", "Future automatic extraction (disabled)."),
  stub("internal.output_validation", "Future output validation (disabled)."),
  stub("internal.response_review", "Future response review (disabled)."),
];
