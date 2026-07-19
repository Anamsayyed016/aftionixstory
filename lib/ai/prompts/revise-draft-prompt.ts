import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import { NATURAL_HINGLISH_PROMPT } from "@/lib/ai/quality/hinglish-quality";
import { assemblePromptSections } from "@/lib/ai/prompts/prompt-registry";
import {
  formatLanguagePromptBlock,
  type LanguagePreferences,
} from "@/lib/story-agent/language-preferences";
import {
  formatStylePromptBlock,
  readStyleProfile,
  type StyleProfile,
} from "@/lib/story-agent/style-profile";

export function buildReviseDraftPrompt(
  ctx: CompactStoryContext,
  languagePrefs: LanguagePreferences,
  style?: StyleProfile
): {
  system: string;
  prompt: string;
} {
  const styleProfile = style ?? readStyleProfile({});

  const system = `You are StoryVerse’s fiction editor-writer.
Rewrite the supplied scene according to the user’s instruction.
Keep the same scene events and continuity unless the user asks to change them.
Return revised prose only — no JSON, no process notes, no metadata questions, no emojis in prose.
Do not explain the rewrite.
Do not translate character names.`;

  const dynamic = assemblePromptSections({
    operation: "revise_draft",
    ctx: { ...ctx, languagePrefs },
    style: styleProfile,
    extra: [
      `USER INSTRUCTION (exact):\n${ctx.userInstruction}`,
      `LANGUAGE REQUIREMENTS (mandatory):\n${formatLanguagePromptBlock(languagePrefs)}`,
      languagePrefs.narrationLanguage === "hinglish" ||
      languagePrefs.dialogueLanguage === "hinglish"
        ? NATURAL_HINGLISH_PROMPT
        : "",
      `STYLE:\n${formatStylePromptBlock(styleProfile)}`,
      `OUTPUT: TITLE: <title> then --- then body. Prose only.`,
    ],
  });

  return { system, prompt: dynamic };
}
