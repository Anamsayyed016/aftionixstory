/**
 * Conversation + collaborative brainstorm prompts (Phase E).
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

function flowBlock(req: PromptRequest): string {
  const flow = req.conversationFlow;
  if (!flow) return "";
  const lastOffers =
    flow.lastOffers?.length > 0
      ? flow.lastOffers.map((o) => o.label).join(" · ")
      : "(none)";
  return `CONVERSATION FLOW:
phase: ${flow.phase}
generationBlocked: ${flow.generationBlocked ? "yes" : "no"}
lastOfferType: ${flow.lastOfferType}
lastOffers (do not repeat identically): ${lastOffers}
awaiting: ${flow.awaiting?.type}/${flow.awaiting?.topic}`;
}

function chatPrefs(req: PromptRequest) {
  return (req.context.preferences || {}) as Record<string, unknown>;
}

function buildGreeting(def: PromptDefinition, req: PromptRequest) {
  const emoji = resolveEmojiLevel(chatPrefs(req));
  const system = joinLayers([
    platformIdentity(),
    conversationBehavior({ emojiLine: buildEmojiLayer(emoji, "chat") }),
    "Greet warmly and briefly. Invite the user to share a story idea. Do not run a wizard checklist. Plain text only.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    flowBlock(req),
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["preferences"],
  });
}

function buildNormal(def: PromptDefinition, req: PromptRequest) {
  const prefs = chatPrefs(req);
  const emoji = resolveEmojiLevel(prefs);
  const system = joinLayers([
    platformIdentity(),
    antiWizardRules(),
    conversationBehavior({
      emojiLine: buildEmojiLayer(emoji, "chat"),
      blocked: Boolean(req.conversationFlow?.generationBlocked),
    }),
    buildLanguageLayer(prefs),
    conflictPriorityPreamble(),
    "Reply in plain natural language only — never JSON, never markdown fences.",
  ]);
  const contextText = serializeDynamicContextForPrompt({
    ...req.context,
    latestDraft: null,
    characters: req.context.characters.slice(0, 4),
    events: [],
    openThreads: [],
  });
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    flowBlock(req),
    contextText ? `STORY CONTEXT:\n${contextText}` : "",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["story", "preferences", "recentConversation"],
  });
}

function buildClarification(def: PromptDefinition, req: PromptRequest) {
  const prefs = chatPrefs(req);
  const emoji = resolveEmojiLevel(prefs);
  const system = joinLayers([
    platformIdentity(),
    antiWizardRules(),
    conversationBehavior({ emojiLine: buildEmojiLayer(emoji, "chat") }),
    buildLanguageLayer(prefs),
    "Ask exactly ONE clear clarifying question. Do not write story prose. Plain text only.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    flowBlock(req),
    req.metadata?.revisionFocus
      ? `CLARIFICATION FOCUS: ${req.metadata.revisionFocus}`
      : "",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["preferences"],
  });
}

function buildBlocked(def: PromptDefinition, req: PromptRequest) {
  const prefs = chatPrefs(req);
  const emoji = resolveEmojiLevel(prefs);
  const system = joinLayers([
    platformIdentity(),
    conversationBehavior({
      emojiLine: buildEmojiLayer(emoji, "chat"),
      blocked: true,
    }),
    buildLanguageLayer(prefs),
    "The user asked to write, but generation is blocked. Acknowledge warmly, discuss concept/characters only, and remind them they can unlock writing when ready. Do NOT write scenes. Plain text only.",
  ]);
  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    flowBlock(req),
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["preferences"],
  });
}

function buildErrorRecovery(def: PromptDefinition, req: PromptRequest) {
  const prefs = chatPrefs(req);
  const emoji = resolveEmojiLevel(prefs);
  const system = joinLayers([
    platformIdentity(),
    buildEmojiLayer(emoji === "none" ? "none" : "light", "chat"),
    "Something went wrong earlier. Apologize briefly, stay helpful, and ask how to continue. Do not expose internals. Plain text only.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user: currentUserInstruction(req.userMessage),
    includedSections: [],
  });
}

function buildCollaborative(def: PromptDefinition, req: PromptRequest) {
  const prefs = chatPrefs(req);
  const emoji = resolveEmojiLevel(prefs);
  const prefer =
    req.metadata?.preferOfferType || "openings";
  const kind = req.metadata?.openConceptKind || "open";
  const system = joinLayers([
    platformIdentity(),
    antiWizardRules(),
    conversationBehavior({
      emojiLine: buildEmojiLayer(emoji, "chat"),
      blocked: Boolean(req.conversationFlow?.generationBlocked),
    }),
    buildLanguageLayer(prefs),
    conflictPriorityPreamble(),
    `COLLABORATIVE BRAINSTORM:
- Answer the CURRENT USER MESSAGE first.
- When helpful, offer 3–4 compact choices relevant to THIS message.
- Prefer offer type "${prefer}" when it fits.
- Do NOT write story prose / scenes unless explicitly asked.
- Never mention JSON, schemas, extraction, missing fields, or validation.

Return JSON only:
{
  "assistantReply": "natural reply with at most one question",
  "offers": [
    { "id": "short_id", "label": "Human label", "prompt": "what to send if clicked", "value": "snake_case" }
  ],
  "conversationPatch": {
    "phase": "exploring|shaping|ready_to_write",
    "lastOfferType": "pairings|dynamics|openings|tones|conflicts|none",
    "awaiting": { "type": "choice|clarification|none", "topic": "pairing|conflict|tone|character|who_falls_first|none" }
  }
}
offers: 0–4 items. Empty offers array is OK if one clear question is better.`,
  ]);

  const ctx = req.context;
  const compactMemory = [
    `concept: ${ctx.story.concept || "none yet"}`,
    `genre: ${ctx.story.genre?.join(", ") || "open"}`,
    `characters: ${
      ctx.characters
        .map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`)
        .join(", ") || "none"
    }`,
    `relationships: ${
      ctx.relationships
        .map(
          (r) =>
            `${r.fromName || r.fromCharacterId}→${r.toName || r.toCharacterId}:${r.type}`
        )
        .join("; ") || "none"
    }`,
  ].join("\n");

  const recent =
    ctx.recentConversation
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n") || "(none)";

  const user = joinLayers([
    currentUserInstruction(req.userMessage),
    `OPEN CONCEPT KIND: ${kind}`,
    `PREFERRED OFFER TYPE: ${prefer}`,
    flowBlock(req),
    `STORY MEMORY (compact):\n${compactMemory}`,
    `RECENT MESSAGES:\n${recent}`,
    "Respond to the current message. Be collaborative, not interrogative.",
  ]);

  return composePromptResult({
    def,
    request: req,
    system,
    user,
    includedSections: ["story", "characters", "relationships", "recentConversation"],
    outputMode: "json",
  });
}

function buildHelp(def: PromptDefinition, req: PromptRequest) {
  const prefs = chatPrefs(req);
  const emoji = resolveEmojiLevel(prefs);
  const system = joinLayers([
    platformIdentity(),
    conversationBehavior({ emojiLine: buildEmojiLayer(emoji, "chat") }),
    buildLanguageLayer(prefs),
    "Explain briefly what you can help with (brainstorm, characters, scenes, revisions, questions). Plain text. At most one question.",
  ]);
  return composePromptResult({
    def,
    request: req,
    system,
    user: currentUserInstruction(req.userMessage),
    includedSections: ["preferences"],
  });
}

export const conversationPrompts: PromptDefinition[] = [
  {
    id: "conversation.greeting",
    version: "1.0.0",
    category: "conversation",
    description: "Warm greeting without wizard checklists.",
    supportedIntents: ["greeting"],
    outputMode: "text",
    contextProfile: "normal_chat",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: ["preferences"],
    enabled: true,
    builder: (req) =>
      buildGreeting(
        conversationPrompts.find((p) => p.id === "conversation.greeting")!,
        req
      ),
  },
  {
    id: "conversation.normal",
    version: "1.0.0",
    category: "conversation",
    description: "Natural collaborative chat reply.",
    supportedIntents: ["normal_chat", "unknown", "general_question", "offer_selection", "awaiting_answer"],
    outputMode: "text",
    contextProfile: "normal_chat",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "medium",
    requiresDraft: false,
    requiredContextSections: ["preferences", "recentConversation"],
    enabled: true,
    builder: (req) =>
      buildNormal(
        conversationPrompts.find((p) => p.id === "conversation.normal")!,
        req
      ),
  },
  {
    id: "conversation.help",
    version: "1.0.0",
    category: "conversation",
    description: "Help / capability overview.",
    supportedIntents: ["help"],
    outputMode: "text",
    contextProfile: "normal_chat",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: ["preferences"],
    enabled: true,
    builder: (req) =>
      buildHelp(
        conversationPrompts.find((p) => p.id === "conversation.help")!,
        req
      ),
  },
  {
    id: "conversation.clarification",
    version: "1.0.0",
    category: "conversation",
    description: "Ask one clarifying question.",
    supportedIntents: ["unknown"],
    outputMode: "text",
    contextProfile: "normal_chat",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: ["preferences"],
    enabled: true,
    builder: (req) =>
      buildClarification(
        conversationPrompts.find((p) => p.id === "conversation.clarification")!,
        req
      ),
  },
  {
    id: "conversation.collaborative_brainstorm",
    version: "1.0.0",
    category: "conversation",
    description: "Phase A collaborative brainstorm with offers JSON.",
    supportedIntents: ["brainstorm"],
    outputMode: "json",
    contextProfile: "brainstorm",
    temperatureProfile: "creative",
    maxOutputTokensProfile: "medium",
    jsonMode: "required",
    requiresDraft: false,
    requiredContextSections: ["story", "preferences", "recentConversation"],
    enabled: true,
    builder: (req) =>
      buildCollaborative(
        conversationPrompts.find(
          (p) => p.id === "conversation.collaborative_brainstorm"
        )!,
        req
      ),
  },
  {
    id: "conversation.blocked_generation",
    version: "1.0.0",
    category: "conversation",
    description: "Refuse creative write while generationBlocked.",
    supportedIntents: ["block_generation", "write_scene"],
    outputMode: "text",
    contextProfile: "normal_chat",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: ["preferences"],
    enabled: true,
    builder: (req) =>
      buildBlocked(
        conversationPrompts.find(
          (p) => p.id === "conversation.blocked_generation"
        )!,
        req
      ),
  },
  {
    id: "conversation.error_recovery",
    version: "1.0.0",
    category: "conversation",
    description: "Friendly recovery after a provider/validation failure.",
    supportedIntents: ["retry"],
    outputMode: "text",
    contextProfile: "normal_chat",
    temperatureProfile: "balanced",
    maxOutputTokensProfile: "short",
    requiresDraft: false,
    requiredContextSections: [],
    enabled: true,
    builder: (req) =>
      buildErrorRecovery(
        conversationPrompts.find(
          (p) => p.id === "conversation.error_recovery"
        )!,
        req
      ),
  },
];
