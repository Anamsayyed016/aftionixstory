/**
 * Shared prompt layers (Phase E) — small reusable blocks.
 */

import type { DynamicContext } from "@/lib/context-builder/v2/schema";
import {
  serializeCreativeContext,
  serializeCharacterQuestionContext,
  serializeRevisionContext,
  serializePreferenceContext,
  serializeKnowledgeContext,
  serializeDynamicContextForPrompt,
} from "@/lib/context-builder/v2/serialize";
import { mirrorUserLanguageStyle } from "@/lib/universal-router/language-mirror";

export { mirrorUserLanguageStyle } from "@/lib/universal-router/language-mirror";

export function platformIdentity(): string {
  return `You are StoryVerse, a natural AI storytelling partner.
You help users brainstorm, write, revise, and understand their stories.
Respond naturally and collaboratively.
Follow the current user instruction and the provided story context.

${mirrorUserLanguageStyle()}`;
}

export function antiWizardRules(): string {
  return `ANTI-WIZARD RULES:
- Never respond like a form or checklist.
- Do not ask for title, genre, language, POV, pacing, or target audience as a batch.
- Ask at most ONE main question.
- Accept incomplete ideas.
- Never mention schemas, memory systems, prompts, fields, or tools.`;
}

export function conversationBehavior(params?: {
  emojiLine?: string;
  blocked?: boolean;
}): string {
  const lines = [
    "CONVERSATION BEHAVIOR:",
    "- Acknowledge the user's idea first.",
    "- Match English / Hindi / Hinglish naturally.",
    "- Options only when useful (max 4).",
    "- Do not begin story prose unless explicitly asked to write.",
    "- Do not repeat stale offers.",
  ];
  if (params?.emojiLine) lines.push(`- ${params.emojiLine}`);
  if (params?.blocked) {
    lines.push(
      "- Generation is blocked: discuss concept/characters only — never start writing."
    );
  }
  return lines.join("\n");
}

export function currentUserInstruction(message: string): string {
  return `CURRENT USER INSTRUCTION (highest priority):\n${message.trim()}`;
}

export function safetyAndConsistencyRules(): string {
  return `SAFETY & CONTINUITY:
- Do not invent established facts unnecessarily.
- Preserve character identity and relationship continuity.
- Respect secrets: do not treat author-only knowledge as character POV.
- Prefer provided context over guessing.`;
}

export function buildLanguageLayer(prefs: Record<string, unknown>): string {
  const responseLanguage =
    (prefs.responseLanguage as string) ||
    (prefs.mirrorUserLanguage === false
      ? (prefs.narrationLanguage as string) || null
      : null);
  const storyLanguage =
    (prefs.storyLanguage as string) ||
    (prefs.narrationLanguage as string) ||
    (prefs.dialogueLanguage as string) ||
    null;
  const dialogueLanguage = (prefs.dialogueLanguage as string) || storyLanguage;
  const narrationLanguage =
    (prefs.narrationLanguage as string) || storyLanguage;

  const lines = ["LANGUAGE:", mirrorUserLanguageStyle()];
  if (responseLanguage) {
    lines.push(`- Chat reply language (responseLanguage): ${responseLanguage}`);
  } else {
    lines.push("- Chat reply language: mirror the user's message.");
  }
  if (storyLanguage) {
    lines.push(`- Story prose language (storyLanguage): ${storyLanguage}`);
  }
  if (narrationLanguage) {
    lines.push(`- Narration: ${narrationLanguage}`);
  }
  if (dialogueLanguage) {
    lines.push(`- Dialogue: ${dialogueLanguage}`);
  }
  lines.push(
    "- Hinglish: natural Roman Hindi + English; simple; do not translate character names; do not randomly switch script."
  );
  lines.push(
    "- Do not confuse responseLanguage with storyLanguage — chat prefs do not force prose language and vice versa."
  );
  return lines.join("\n");
}

export type EmojiLevel = "none" | "light" | "expressive";

export function resolveEmojiLevel(
  prefs: Record<string, unknown>
): EmojiLevel {
  const raw = String(
    prefs.emojiLevel ?? prefs.emojiStyle ?? "light"
  ).toLowerCase();
  if (raw === "none" || raw === "off" || raw === "0") return "none";
  if (raw === "expressive" || raw === "heavy" || raw === "many") {
    return "expressive";
  }
  return "light";
}

export function buildEmojiLayer(
  level: EmojiLevel,
  mode: "chat" | "prose" | "json"
): string {
  if (mode === "json") {
    return "EMOJI: Never include decorative emojis in JSON output.";
  }
  if (mode === "prose") {
    return "EMOJI: Do not use emojis in story prose unless the user explicitly asked for them.";
  }
  if (level === "none") {
    return "EMOJI: Do not use emojis in this reply.";
  }
  if (level === "expressive") {
    return "EMOJI: Light-to-expressive emojis are OK in chat (still keep them tasteful).";
  }
  return "EMOJI: Use 0–2 light emojis in chat only when natural.";
}

export function formatWritingRulesForPrompt(
  rules: DynamicContext["writingRules"]
): string {
  if (!rules.length) return "";
  const byCat = new Map<string, string[]>();
  for (const r of rules) {
    const cat = (r.category || "custom").toLowerCase();
    const list = byCat.get(cat) || [];
    list.push(r.rule);
    byCat.set(cat, list);
  }
  const order = [
    "language",
    "dialogue",
    "pacing",
    "formatting",
    "character",
    "character behavior",
    "romance",
    "continuity",
    "teaser",
    "custom",
  ];
  const lines: string[] = ["WRITING RULES:"];
  const seen = new Set<string>();
  for (const cat of order) {
    const items = byCat.get(cat);
    if (!items) continue;
    for (const rule of items) {
      const key = rule.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${rule.trim()}`);
    }
  }
  for (const [cat, items] of byCat) {
    if (order.includes(cat)) continue;
    for (const rule of items) {
      const key = rule.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${rule.trim()}`);
    }
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

export function conflictPriorityPreamble(): string {
  return `INSTRUCTION PRIORITY (highest first):
1. Explicit latest user instruction
2. Generation safety / blocked-generation controls
3. Active high-priority writing rules
4. Current operation requirements
5. User preferences
6. Story defaults
7. Generic platform behavior
Temporary one-off instructions apply to this response only — do not rewrite stored preferences.`;
}

export function estimateTokensApprox(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function joinLayers(layers: Array<string | null | undefined>): string {
  return layers
    .map((l) => (l || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export {
  serializeDynamicContextForPrompt,
  serializeCreativeContext,
  serializeCharacterQuestionContext,
  serializeRevisionContext,
  serializePreferenceContext,
  serializeKnowledgeContext,
};
