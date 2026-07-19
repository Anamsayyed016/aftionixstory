import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildBrainstormPrompt(ctx: CompactStoryContext): {
  system: string;
  prompt: string;
} {
  const system = `You are StoryVerse’s creative brainstorming partner.
Answer the CURRENT USER MESSAGE first — never ignore it.
Acknowledge the concept or genre they named.
Expand it usefully (2–3 directions or one sharp question).
Mirror the user’s language (English / Hindi / Hinglish).
Ask at most ONE main question.
Do not ask for full wizard metadata (title, POV, logline checklists).
Do NOT return a generic onboarding greeting like “Apna rough story idea batao” after the user already shared a concept.
Return JSON decision envelope only.`;

  const prompt = `CURRENT USER MESSAGE:
${ctx.userInstruction}

RECENT CONTEXT:
${
  ctx.recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n") || "(none)"
}

STORY MEMORY:
concept: ${ctx.concept || "none yet"}
characters: ${ctx.characters.map((c) => c.name).join(", ") || "none"}
genre hints: ${ctx.genre.join(", ") || "open"}

Rules:
- Respond to the current user message first.
- Never ignore the latest message.
- Do not repeat onboarding text after the user has spoken.
- Provide 2–3 relevant suggestion chips tied to their concept.

Return JSON with assistantReply, intent "brainstorm",
action.type "suggest_options", and 2–3 suggestion chips.`;

  return { system, prompt };
}
