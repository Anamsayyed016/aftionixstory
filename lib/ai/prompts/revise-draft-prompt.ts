import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import {
  formatLanguagePromptBlock,
  type LanguagePreferences,
} from "@/lib/story-agent/language-preferences";

export function buildReviseDraftPrompt(
  ctx: CompactStoryContext,
  languagePrefs: LanguagePreferences
): {
  system: string;
  prompt: string;
} {
  const languageBlock = formatLanguagePromptBlock(languagePrefs);

  const system = `You are StoryVerse’s fiction editor-writer.
Rewrite the supplied scene according to the user’s instruction.
Keep the same scene events and continuity unless the user asks to change them.
Return revised prose only — no JSON, no process notes, no metadata questions.
Do not explain the rewrite.
Do not translate character names.`;

  const chars = ctx.characters
    .map((c) => {
      const bits = [
        c.name,
        c.role ? `(${c.role})` : "",
        c.personality.length ? `personality: ${c.personality.join(", ")}` : "",
        c.avoid.length ? `avoid: ${c.avoid.join(", ")}` : "",
      ].filter(Boolean);
      return `- ${bits.join(" — ")}`;
    })
    .join("\n");

  const rels = ctx.relationships
    .map(
      (r) =>
        `- ${r.from} → ${r.to}: ${r.type}${r.notes ? ` (${r.notes})` : ""}`
    )
    .join("\n");

  const rules = ctx.writingRules.map((r) => `- ${r}`).join("\n");
  const avoid = [
    ...ctx.preferences.avoid,
    ...ctx.characters.flatMap((c) => c.avoid.map((a) => `${c.name}: ${a}`)),
  ];

  const prompt = `USER INSTRUCTION (exact):
${ctx.userInstruction}

LANGUAGE REQUIREMENTS (mandatory):
${languageBlock}
- Narration language: ${languagePrefs.narrationLanguage}
- Dialogue language: ${languagePrefs.dialogueLanguage}
- Script preference: ${languagePrefs.scriptPreference}

STORY CONTEXT
Tone: ${ctx.tone.join(", ") || "preserve from draft"}
POV: ${ctx.pov || "preserve from draft"}
Pacing: ${ctx.pacing || "preserve from draft"}
Writing style: ${ctx.writingStyle || "preserve from draft"}

Characters:
${chars || "- (from draft)"}

Relationships:
${rels || "- none stored"}

Writing rules:
${rules || "- none stored"}

Negative constraints:
${avoid.length ? avoid.map((a) => `- ${a}`).join("\n") : "- none"}

PREVIOUS DRAFT (rewrite this):
${ctx.latestDraftPreview || "(missing)"}

OUTPUT REQUIREMENTS:
- Revised prose only
- Apply the language requirements above — do not leave the draft in the wrong language
- Optional first line: TITLE: <title> then --- then body
Rewrite now.`;

  return { system, prompt };
}
