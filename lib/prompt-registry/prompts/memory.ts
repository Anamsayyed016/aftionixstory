/**
 * Memory and preference prompts (Phase E).
 */

import {
  buildEmojiLayer,
  buildLanguageLayer,
  conflictPriorityPreamble,
  currentUserInstruction,
  joinLayers,
  platformIdentity,
  resolveEmojiLevel,
  serializePreferenceContext,
  serializeDynamicContextForPrompt,
} from "@/lib/prompt-registry/layers";
import { composePromptResult } from "@/lib/prompt-registry/compose";
import type { PromptDefinition, PromptRequest } from "@/lib/prompt-registry/types";
import { isStoryToolFrameworkEnabled } from "@/lib/tools/feature-flag";

function prefs(req: PromptRequest) {
  return (req.context.preferences || {}) as Record<string, unknown>;
}

function memoryUpdateBuilder(def: PromptDefinition, req: PromptRequest) {
  const toolMode = isStoryToolFrameworkEnabled();
  const system = joinLayers([
    platformIdentity(),
    conflictPriorityPreamble(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "json"),
    toolMode
      ? `MEMORY UPDATE (TOOL FRAMEWORK):
- Do NOT emit memoryPatch.
- Emit ToolRequest JSON:
{"toolRequests":[{"toolId":"...","arguments":{},"reason":"...","confidence":0.9}],"assistantReply":"..."}
- Providers never mutate memory.
- Do NOT generate story prose.
- Return JSON only. No markdown fences.`
      : `MEMORY UPDATE RULES:
- Extract only explicit corrections and facts into memoryPatch.
- Acknowledge naturally in assistantReply (mirror language).
- Do NOT generate story prose.
- Do NOT mutate a database — output a patch suggestion only.
- Do NOT set action to generate_episode.
- Return JSON only. No markdown fences.`,
  ]);
  const slim = {
    ...req.context,
    latestDraft: null,
    recentConversation: req.context.recentConversation.slice(-4),
  };
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeDynamicContextForPrompt(slim),
    toolMode
      ? `Return toolRequests for the explicit memory mutation.`
      : `Return JSON decision with memoryPatch reflecting the update/removal,
action.type "none", intent "update_story" or "manage_character".`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["characters", "relationships"],
    outputMode: "json",
  });
}

function memoryCorrectionBuilder(def: PromptDefinition, req: PromptRequest) {
  const system = joinLayers([
    platformIdentity(),
    conflictPriorityPreamble(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer("none", "json"),
    `MEMORY CORRECTION RULES:
- Identify the target entity.
- Distinguish incorrect vs corrected value.
- Avoid destructive deletion.
- If ambiguous, set needsClarification and ask one clarifying question in assistantReply.
- Output strict JSON patch suggestion only — never instruct DB writes.
- No markdown fences.`,
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializeDynamicContextForPrompt({
      ...req.context,
      latestDraft: null,
      events: req.context.events.slice(0, 4),
      openThreads: [],
    }),
    `Return JSON with assistantReply, memoryPatch (canonical shape), and optional clarification flag.`,
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["characters", "relationships"],
    outputMode: "json",
  });
}

function memoryDeleteBuilder(def: PromptDefinition, req: PromptRequest) {
  const emoji = resolveEmojiLevel(prefs(req));
  const system = joinLayers([
    platformIdentity(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer(emoji, "chat"),
    "Confirm what the user wants deleted. Do not delete silently. Ask one confirmation question if the target is unclear. Plain text unless JSON patch is required by the executor envelope.",
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
        openThreads: [],
      }),
    ]),
    includedSections: ["characters"],
  });
}

function preferenceBuilder(
  def: PromptDefinition,
  req: PromptRequest,
  focus: string
) {
  const emoji = resolveEmojiLevel(prefs(req));
  const system = joinLayers([
    platformIdentity(),
    conflictPriorityPreamble(),
    buildLanguageLayer(prefs(req)),
    buildEmojiLayer(emoji, "chat"),
    `PREFERENCE UPDATE (${focus}):
- Confirm the preference change naturally.
- Distinguish responseLanguage vs storyLanguage when relevant.
- Do not dump story cast or events.
- Plain text only (no JSON) unless the executor requires an envelope.`,
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    serializePreferenceContext(req.context),
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["preferences", "writingRules"],
  });
}

function mkPref(
  id: PromptDefinition["id"],
  intents: string[],
  focus: string,
  description: string
): PromptDefinition {
  const base: PromptDefinition = {
    id,
    version: "1.0.0",
    category: "preference",
    description,
    supportedIntents: intents,
    outputMode: "text",
    contextProfile: "language_change",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: ["preferences"],
    enabled: true,
    builder: (r) => preferenceBuilder(base, r, focus),
  };
  return base;
}

export const memoryPrompts: PromptDefinition[] = [
  {
    id: "memory.update",
    version: "1.0.0",
    category: "memory",
    description: "Produce a memory patch suggestion from explicit facts.",
    supportedIntents: [
      "memory_update",
      "create_character",
      "update_character",
      "create_relationship",
      "update_relationship",
      "create_location",
      "update_location",
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
      memoryUpdateBuilder(
        memoryPrompts.find((p) => p.id === "memory.update")!,
        req
      ),
  },
  {
    id: "memory.correction",
    version: "1.0.0",
    category: "memory",
    description: "Produce a correction patch with ambiguity handling.",
    supportedIntents: ["memory_correction"],
    outputMode: "json",
    contextProfile: "memory_correction",
    temperatureProfile: "deterministic",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["characters", "relationships"],
    enabled: true,
    builder: (req) =>
      memoryCorrectionBuilder(
        memoryPrompts.find((p) => p.id === "memory.correction")!,
        req
      ),
  },
  {
    id: "memory.delete_confirmation",
    version: "1.0.0",
    category: "memory",
    description: "Confirm memory deletion target.",
    supportedIntents: ["memory_delete"],
    outputMode: "text",
    contextProfile: "memory_correction",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: ["characters"],
    enabled: true,
    builder: (req) =>
      memoryDeleteBuilder(
        memoryPrompts.find((p) => p.id === "memory.delete_confirmation")!,
        req
      ),
  },
];

export const preferencePrompts: PromptDefinition[] = [
  mkPref(
    "preference.language",
    ["language_change"],
    "language",
    "Confirm response/story language preference."
  ),
  mkPref(
    "preference.style",
    ["style_change"],
    "style",
    "Confirm writing style preference."
  ),
  mkPref("preference.tone", ["tone_change"], "tone", "Confirm tone preference."),
  mkPref(
    "preference.pacing",
    ["pacing_change"],
    "pacing",
    "Confirm pacing preference."
  ),
  mkPref("preference.pov", ["pov_change"], "POV", "Confirm POV preference."),
  mkPref(
    "preference.emoji",
    ["emoji_preference"],
    "emoji",
    "Confirm emoji preference."
  ),
];
