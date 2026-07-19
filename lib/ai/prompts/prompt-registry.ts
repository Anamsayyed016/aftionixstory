import { NATURAL_HINGLISH_PROMPT } from "@/lib/ai/quality/hinglish-quality";
import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import { formatLanguagePromptBlock } from "@/lib/story-agent/language-preferences";
import {
  formatStylePromptBlock,
  type StyleProfile,
} from "@/lib/story-agent/style-profile";
import type { StoryOperation } from "@/lib/story-agent/operations";

export function buildLanguageSection(ctx: CompactStoryContext): string {
  return `LANGUAGE REQUIREMENTS:
${formatLanguagePromptBlock(ctx.languagePrefs)}
- Narration: ${ctx.languagePrefs.narrationLanguage}
- Dialogue: ${ctx.languagePrefs.dialogueLanguage}
- Script: ${ctx.languagePrefs.scriptPreference}

${
  ctx.languagePrefs.narrationLanguage === "hinglish" ||
  ctx.languagePrefs.dialogueLanguage === "hinglish"
    ? NATURAL_HINGLISH_PROMPT
    : ""
}`;
}

export function buildStyleSection(style: StyleProfile): string {
  return `STYLE PROFILE:
${formatStylePromptBlock(style)}
Emoji style applies to chat replies only — never put emojis in story prose unless the scene is literally a text/chat thread.`;
}

export function buildCharacterSection(ctx: CompactStoryContext): string {
  if (ctx.characters.length === 0) return "";
  return `CHARACTERS:
${ctx.characters
  .map((c) => {
    const bits = [
      c.name,
      c.role ? `(${c.role})` : "",
      c.personality.length ? `personality: ${c.personality.join(", ")}` : "",
      c.avoid.length ? `avoid: ${c.avoid.join(", ")}` : "",
    ].filter(Boolean);
    return `- ${bits.join(" — ")}`;
  })
  .join("\n")}`;
}

export function buildContinuitySection(ctx: CompactStoryContext): string {
  const parts = [
    ctx.concept ? `Concept: ${ctx.concept}` : "",
    ctx.title ? `Title: ${ctx.title}` : "",
    ctx.genre.length ? `Genre: ${ctx.genre.join(", ")}` : "",
    ctx.tone.length ? `Tone: ${ctx.tone.join(", ")}` : "",
    ctx.setting ? `Setting: ${ctx.setting}` : "",
    ctx.plot ? `Plot notes: ${ctx.plot}` : "",
    ctx.relationships.length
      ? `Relationships:\n${ctx.relationships
          .map((r) => `- ${r.from} → ${r.to}: ${r.type}`)
          .join("\n")}`
      : "",
  ].filter(Boolean);
  return parts.length ? `STORY CONTEXT:\n${parts.join("\n")}` : "";
}

export function buildConstraintsSection(ctx: CompactStoryContext): string {
  const avoid = [
    ...ctx.preferences.avoid,
    ...ctx.characters.flatMap((c) => c.avoid.map((a) => `${c.name}: ${a}`)),
  ];
  const rules = ctx.writingRules.map((r) => `- ${r}`);
  const lines = [
    ...rules,
    ...avoid.map((a) => `- Avoid: ${a}`),
  ];
  return lines.length ? `CONSTRAINTS:\n${lines.join("\n")}` : "";
}

/** Compose only relevant sections for an operation. */
export function assemblePromptSections(params: {
  operation: StoryOperation;
  ctx: CompactStoryContext;
  style: StyleProfile;
  extra?: string[];
}): string {
  const { operation, ctx, style } = params;
  const sections: string[] = [];

  if (
    operation === "write_scene" ||
    operation === "revise_draft" ||
    operation === "start_story" ||
    operation === "generate_episode" ||
    operation === "continue_episode"
  ) {
    sections.push(buildContinuitySection(ctx));
    sections.push(buildCharacterSection(ctx));
    if (ctx.relationships.length) {
      sections.push(
        `RELATIONSHIPS:\n${ctx.relationships
          .map((r) => `- ${r.from} → ${r.to}: ${r.type}`)
          .join("\n")}`
      );
    }
    sections.push(buildLanguageSection(ctx));
    sections.push(buildStyleSection(style));
    sections.push(buildConstraintsSection(ctx));
    if (
      (operation === "revise_draft" || operation === "continue_episode") &&
      ctx.includeLatestDraft &&
      ctx.latestDraftPreview
    ) {
      sections.push(`LATEST DRAFT (relevant to this operation):\n${ctx.latestDraftPreview}`);
    }
  } else if (
    operation === "conversational_chat" ||
    operation === "brainstorm" ||
    operation === "suggest_options"
  ) {
    sections.push(buildContinuitySection(ctx));
    sections.push(buildCharacterSection(ctx));
    sections.push(buildStyleSection(style));
  } else if (operation === "memory_update") {
    sections.push(buildCharacterSection(ctx));
  }

  for (const extra of params.extra ?? []) {
    if (extra.trim()) sections.push(extra);
  }

  return sections.filter(Boolean).join("\n\n");
}
