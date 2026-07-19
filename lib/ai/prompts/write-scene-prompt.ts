import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import { NATURAL_HINGLISH_PROMPT } from "@/lib/ai/quality/hinglish-quality";
import {
  buildCharacterSection,
  buildConstraintsSection,
  buildContinuitySection,
  buildLanguageSection,
  buildStyleSection,
} from "@/lib/ai/prompts/prompt-registry";
import {
  readStyleProfile,
  type StyleProfile,
} from "@/lib/story-agent/style-profile";

export function buildWriteScenePrompt(
  ctx: CompactStoryContext,
  style?: StyleProfile
): {
  system: string;
  prompt: string;
} {
  const wordLine = ctx.wordTarget
    ? `Target length: about ${ctx.wordTarget.min ?? "?"}–${ctx.wordTarget.max ?? "?"} words.`
    : "Target length: a short scene (roughly 300–600 words) unless the user specified otherwise.";

  const styleProfile = style ?? readStyleProfile({});

  const system = `You are StoryVerse’s fiction writer.
Write only the requested scene as plain prose.
The CURRENT USER REQUEST has highest priority.
Never substitute characters, setting, relationship, or conflict from an unrelated previous draft.
If the current request names characters, use those characters.
Do not introduce unrelated lead characters.
Do not ask metadata questions.
Do not explain your process.
Do not return JSON or emojis in story prose.
Follow LANGUAGE and STYLE requirements exactly.`;

  const requestedChars =
    ctx.namedInRequest.length > 0
      ? ctx.namedInRequest.join(", ")
      : ctx.characters.map((c) => c.name).join(", ") || "(derive from request)";

  const sceneFocus = [
    ...ctx.actionHints,
    ...ctx.conflictHints,
    ctx.settingOverride ? `setting: ${ctx.settingOverride}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  const sections = [
    `CURRENT REQUEST (highest priority):\n${ctx.userInstruction}`,
    `REQUESTED CHARACTERS:\n${requestedChars}`,
    sceneFocus ? `SCENE REQUEST:\n${sceneFocus}` : "",
    `PROHIBITED:\n- Do not introduce unrelated lead characters\n- Do not reuse another conversation’s story\n- Do not change the requested character names`,
    buildContinuitySection(ctx),
    buildCharacterSection(ctx),
    ctx.relationships.length
      ? `RELATIONSHIPS:\n${ctx.relationships
          .map((r) => `- ${r.from} → ${r.to}: ${r.type}`)
          .join("\n")}`
      : "",
    buildLanguageSection(ctx),
    buildStyleSection(styleProfile),
    buildConstraintsSection(ctx),
    ctx.languagePrefs.narrationLanguage === "hinglish" ||
    ctx.languagePrefs.dialogueLanguage === "hinglish"
      ? NATURAL_HINGLISH_PROMPT
      : "",
    `OUTPUT REQUIREMENTS:\n- Prose only\n- ${wordLine}\n- Feature the requested characters and the requested conflict/action\n- Optional: TITLE: … then --- then body`,
  ];

  return { system, prompt: sections.filter(Boolean).join("\n\n") };
}
