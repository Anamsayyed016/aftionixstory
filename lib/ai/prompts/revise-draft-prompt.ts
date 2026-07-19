import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildReviseDraftPrompt(ctx: CompactStoryContext): {
  system: string;
  prompt: string;
} {
  const system = `You are StoryVerse’s fiction editor-writer.
Revise the previous draft according to the user’s instruction.
Return plain prose only — no JSON, no process notes, no metadata questions.
Preserve continuity and established facts unless the user asks to change them.
Mirror the user’s language style.`;

  const prompt = `Revision instruction:
${ctx.userInstruction}

Language: ${ctx.languageHint}
Characters to honor:
${ctx.characters.map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ""}`).join("\n") || "- (from draft)"}

Previous draft:
${ctx.latestDraftPreview || "(missing — write a short revised scene from the instruction alone)"}

OUTPUT:
TITLE: <revised title>
---
<body>`;

  return { system, prompt };
}
