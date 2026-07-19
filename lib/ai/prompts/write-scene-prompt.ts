import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import { NATURAL_HINGLISH_PROMPT } from "@/lib/ai/quality/hinglish-quality";
import { assemblePromptSections } from "@/lib/ai/prompts/prompt-registry";
import { formatLanguagePromptBlock } from "@/lib/story-agent/language-preferences";
import {
  formatStylePromptBlock,
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
Follow all established story facts.
Do not ask metadata questions.
Do not explain your process.
Do not return JSON or emojis in story prose.
Follow LANGUAGE and STYLE requirements exactly.`;

  const dynamic = assemblePromptSections({
    operation: "write_scene",
    ctx,
    style: styleProfile,
    extra: [
      `LANGUAGE:\n${formatLanguagePromptBlock(ctx.languagePrefs)}`,
      ctx.languagePrefs.narrationLanguage === "hinglish" ||
      ctx.languagePrefs.dialogueLanguage === "hinglish"
        ? NATURAL_HINGLISH_PROMPT
        : "",
      `STYLE:\n${formatStylePromptBlock(styleProfile)}`,
      `USER REQUEST:\n${ctx.userInstruction}`,
      `OUTPUT REQUIREMENTS:\n- Prose only\n- ${wordLine}\n- Optional: TITLE: … then --- then body`,
    ],
  });

  return { system, prompt: dynamic };
}
