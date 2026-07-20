/**
 * Revision prompts (Phase E).
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
  serializeRevisionContext,
} from "@/lib/prompt-registry/layers";
import { composePromptResult } from "@/lib/prompt-registry/compose";
import type { PromptDefinition, PromptRequest } from "@/lib/prompt-registry/types";

function prefs(req: PromptRequest) {
  return (req.context.preferences || {}) as Record<string, unknown>;
}

function revisionBuilder(
  def: PromptDefinition,
  req: PromptRequest,
  transformLines: string[]
) {
  const system = joinLayers([
    platformIdentity(),
    conflictPriorityPreamble(),
    safetyAndConsistencyRules(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "prose"),
    formatWritingRulesForPrompt(req.context.writingRules),
    `REVISION OPERATION:\n${transformLines.map((l) => `- ${l}`).join("\n")}`,
    "Operate on the supplied draft only. Return revised prose only — no JSON, no explanations, no metadata questions.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeRevisionContext(req.context),
    "OUTPUT: TITLE: <title> then --- then body. Prose only.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["latestDraft", "characters", "writingRules", "preferences"],
  });
}

function def(
  partial: Omit<PromptDefinition, "builder"> & {
    transform: string[];
  }
): PromptDefinition {
  const base: PromptDefinition = {
    ...partial,
    builder: (r) => revisionBuilder(base, r, partial.transform),
  };
  return base;
}

export const revisionPrompts: PromptDefinition[] = [
  def({
    id: "revision.rewrite",
    version: "1.0.0",
    category: "revision",
    description: "General rewrite of the supplied draft.",
    supportedIntents: ["rewrite"],
    outputMode: "text",
    contextProfile: "rewrite",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Rewrite according to the user instruction.",
      "Keep the same scene events and continuity unless asked to change them.",
      "Preserve names and relationships.",
      "Do not restart the scene or add unrelated plot.",
    ],
  }),
  def({
    id: "revision.emotional",
    version: "1.0.0",
    category: "revision",
    description: "Increase emotional depth of the draft.",
    supportedIntents: ["make_emotional"],
    outputMode: "text",
    contextProfile: "make_emotional",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Increase emotional depth, internal feeling, and reaction beats.",
      "Do not randomly add tragedy or unrelated plot.",
      "Preserve core events and character names.",
    ],
  }),
  def({
    id: "revision.romantic",
    version: "1.0.0",
    category: "revision",
    description: "Increase romantic tone of the draft.",
    supportedIntents: ["make_romantic"],
    outputMode: "text",
    contextProfile: "make_romantic",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Heighten romantic tension and intimacy appropriate to the scene.",
      "Do not break established relationship continuity.",
      "Do not add unrelated characters or plot.",
    ],
  }),
  def({
    id: "revision.funny",
    version: "1.0.0",
    category: "revision",
    description: "Add humor without breaking continuity.",
    supportedIntents: ["make_funny"],
    outputMode: "text",
    contextProfile: "make_funny",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Add situational/dialogue humor.",
      "Do not break serious continuity if the scene is grounded.",
      "Do not restart the scene.",
    ],
  }),
  def({
    id: "revision.tone",
    version: "1.0.0",
    category: "revision",
    description: "Adjust draft tone.",
    supportedIntents: ["revise_tone", "tone_change"],
    outputMode: "text",
    contextProfile: "revise_tone",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Apply only the requested tone change.",
      "Preserve facts, names, and plot beats.",
    ],
  }),
  def({
    id: "revision.style",
    version: "1.0.0",
    category: "revision",
    description: "Adjust draft style.",
    supportedIntents: ["revise_style", "style_change"],
    outputMode: "text",
    contextProfile: "revise_style",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Apply only the requested style change.",
      "Preserve facts, names, and plot beats.",
    ],
  }),
  def({
    id: "revision.shorten",
    version: "1.0.0",
    category: "revision",
    description: "Shorten the draft while preserving meaning.",
    supportedIntents: ["shorten"],
    outputMode: "text",
    contextProfile: "shorten",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "long",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Reduce length while preserving the core event and emotional meaning.",
      "Do not drop essential character actions.",
      "Do not add new plot.",
    ],
  }),
  def({
    id: "revision.expand",
    version: "1.0.0",
    category: "revision",
    description: "Expand the draft with more detail.",
    supportedIntents: ["expand"],
    outputMode: "text",
    contextProfile: "expand",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "long_creative",
    requiresDraft: true,
    requiredContextSections: ["latestDraft"],
    enabled: true,
    transform: [
      "Expand sensory detail, emotion, and dialogue where useful.",
      "Do not invent a new plot direction unless asked.",
    ],
  }),
];
