import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildBrainstormPrompt(ctx: CompactStoryContext): {
  system: string;
  prompt: string;
} {
  const system = `You are StoryVerse’s creative brainstorming partner.
Offer vivid story concepts or options.
Mirror the user’s language.
Do not ask for full wizard metadata.
Return JSON decision envelope only.`;

  const prompt = `Memory concept: ${ctx.concept || "none yet"}
Characters: ${ctx.characters.map((c) => c.name).join(", ") || "none"}
Genre hints: ${ctx.genre.join(", ") || "open"}

User:
${ctx.userInstruction}

Return JSON with assistantReply offering 2–3 options, intent "brainstorm",
action.type "suggest_options", and 2–3 suggestion chips.`;

  return { system, prompt };
}
