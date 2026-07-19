import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildMemoryUpdatePrompt(ctx: CompactStoryContext): {
  system: string;
  prompt: string;
} {
  const system = `You are StoryVerse’s story-memory editor.
Extract only explicit corrections and facts into memoryPatch.
Acknowledge naturally in assistantReply (mirror language).
Do NOT generate story prose.
Do NOT set action to generate_episode.
Return JSON only.`;

  const prompt = `Current characters:
${JSON.stringify(ctx.characters, null, 2)}

Current relationships:
${JSON.stringify(ctx.relationships, null, 2)}

User correction / fact:
${ctx.userInstruction}

Return JSON decision with memoryPatch reflecting the update/removal,
action.type "none", intent "update_story" or "manage_character".`;

  return { system, prompt };
}
