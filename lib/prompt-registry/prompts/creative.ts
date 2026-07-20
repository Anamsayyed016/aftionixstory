/**
 * Creative writing prompts (Phase E).
 */

import {
  buildEmojiLayer,
  buildLanguageLayer,
  conflictPriorityPreamble,
  currentUserInstruction,
  formatWritingRulesForPrompt,
  joinLayers,
  platformIdentity,
  safetyAndConsistencyRules,
  serializeCreativeContext,
  serializeRevisionContext,
} from "@/lib/prompt-registry/layers";
import { composePromptResult } from "@/lib/prompt-registry/compose";
import type { PromptDefinition, PromptRequest } from "@/lib/prompt-registry/types";

function prefs(req: PromptRequest) {
  return (req.context.preferences || {}) as Record<string, unknown>;
}

function creativeSystem(
  def: PromptDefinition,
  req: PromptRequest,
  opLines: string[]
) {
  return joinLayers([
    platformIdentity(),
    conflictPriorityPreamble(),
    safetyAndConsistencyRules(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "prose"),
    formatWritingRulesForPrompt(req.context.writingRules),
    `OPERATION:\n${opLines.map((l) => `- ${l}`).join("\n")}`,
    "Output only the requested story content unless the user asked for an explanation. No JSON. No process notes.",
  ]);
}

function sceneBuilder(def: PromptDefinition, req: PromptRequest) {
  const names = req.context.characters.map((c) => c.name).join(", ") || "(from request)";
  const system = creativeSystem(def, req, [
    "Write only the requested scene as plain prose.",
    "CURRENT USER REQUEST has highest priority.",
    "If the request names characters, use those characters.",
    "Do not introduce unrelated lead characters.",
    "Do not substitute cast/setting from an unrelated previous draft.",
    "Target ~300–600 words unless the user specified otherwise.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    `REQUESTED CHARACTERS:\n${names}`,
    serializeCreativeContext(req.context),
    "OUTPUT: Optional TITLE: … then --- then body. Prose only.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: [
      "story",
      "characters",
      "relationships",
      "continuity",
      "writingRules",
      "preferences",
    ],
  });
}

function episodeBuilder(def: PromptDefinition, req: PromptRequest) {
  const system = creativeSystem(def, req, [
    "Write a single episode as plain prose (not a short scene).",
    "Use provided continuity, characters, and open threads.",
    "Structure with a clear beginning, middle beat, and ending hook when appropriate.",
    "Do not invent missing episode history — stay within provided context.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeCreativeContext(req.context),
    "OUTPUT: Optional TITLE: … then --- then body. Prose only.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: [
      "story",
      "characters",
      "relationships",
      "events",
      "openThreads",
      "continuity",
      "writingRules",
    ],
  });
}

function continueBuilder(def: PromptDefinition, req: PromptRequest) {
  const system = creativeSystem(def, req, [
    "Continue the story naturally from the provided latestDraft ending.",
    "Do not restart the scene.",
    "Preserve names, relationships, and continuity.",
    "Begin as a seamless continuation.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeRevisionContext(req.context),
    "OUTPUT: Continued prose only (no recap of the whole previous draft).",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: [
      "latestDraft",
      "characters",
      "continuity",
      "events",
      "writingRules",
    ],
  });
}

function dialogueBuilder(def: PromptDefinition, req: PromptRequest) {
  const dialogueRules = req.context.writingRules.filter((r) =>
    /dialogue|language|voice|speech/i.test(`${r.category} ${r.rule}`)
  );
  const system = creativeSystem(def, req, [
    "Generate dialogue (and light beats) matching character voices.",
    "Prioritize dialogue/language writing rules.",
    "Keep narration minimal unless asked for a full scene.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeCreativeContext(req.context),
    formatWritingRulesForPrompt(
      dialogueRules.length ? dialogueRules : req.context.writingRules
    ),
    "OUTPUT: Dialogue-focused prose only.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["characters", "relationships", "writingRules", "preferences"],
  });
}

function descriptionBuilder(def: PromptDefinition, req: PromptRequest) {
  const system = creativeSystem(def, req, [
    "Write a vivid description (setting, mood, or character moment).",
    "Do not advance a full plot scene unless asked.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeCreativeContext(req.context),
    "OUTPUT: Descriptive prose only.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["story", "locations", "characters", "writingRules"],
  });
}

function def(
  partial: Omit<PromptDefinition, "builder"> & {
    builder: (d: PromptDefinition, r: PromptRequest) => ReturnType<typeof sceneBuilder>;
  }
): PromptDefinition {
  const base = { ...partial, builder: (r: PromptRequest) => partial.builder(base, r) };
  return base;
}

export const creativePrompts: PromptDefinition[] = [
  def({
    id: "creative.scene",
    version: "1.0.0",
    category: "creative",
    description: "Generate a story scene using scoped context.",
    supportedIntents: ["write_scene"],
    outputMode: "text",
    contextProfile: "write_scene",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: false,
    requiredContextSections: [
      "story",
      "characters",
      "relationships",
      "continuity",
      "writingRules",
      "preferences",
    ],
    enabled: true,
    builder: sceneBuilder,
  }),
  def({
    id: "creative.episode",
    version: "1.0.0",
    category: "creative",
    description: "Generate an episode using scoped context.",
    supportedIntents: ["write_episode"],
    outputMode: "text",
    contextProfile: "write_episode",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: false,
    requiredContextSections: ["story", "characters", "continuity", "writingRules"],
    enabled: true,
    builder: episodeBuilder,
  }),
  def({
    id: "creative.continue",
    version: "1.0.0",
    category: "creative",
    description: "Continue from latest draft ending.",
    supportedIntents: ["continue_story"],
    outputMode: "text",
    contextProfile: "continue_story",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft", "continuity", "characters"],
    enabled: true,
    builder: continueBuilder,
  }),
  def({
    id: "creative.dialogue",
    version: "1.0.0",
    category: "creative",
    description: "Generate dialogue with character voices.",
    supportedIntents: ["generate_dialogue"],
    outputMode: "text",
    contextProfile: "generate_dialogue",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long",
    requiresDraft: false,
    requiredContextSections: ["characters", "writingRules", "preferences"],
    enabled: true,
    builder: dialogueBuilder,
  }),
  def({
    id: "creative.description",
    version: "1.0.0",
    category: "creative",
    description: "Generate descriptive prose.",
    supportedIntents: ["generate_description"],
    outputMode: "text",
    contextProfile: "generate_description",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["story", "locations"],
    enabled: true,
    builder: descriptionBuilder,
  }),
];
