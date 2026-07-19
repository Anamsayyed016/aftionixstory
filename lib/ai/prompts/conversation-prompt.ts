import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildConversationSystemPrompt(): string {
  return `You are StoryVerse’s storytelling collaborator.
Respond naturally to what the user said.
Mirror English / Hindi / Hinglish.
Ask at most one question when useful.
Never run a form interview (no title/genre/POV checklists).
Never claim you wrote a scene unless a creative write operation ran.
Return JSON only (decision envelope).`;
}

export function buildConversationUserPrompt(ctx: CompactStoryContext): string {
  const memory = {
    concept: ctx.concept,
    title: ctx.title,
    genre: ctx.genre,
    characters: ctx.characters.map((c) => ({
      name: c.name,
      role: c.role,
      personality: c.personality,
      avoid: c.avoid,
    })),
    relationships: ctx.relationships,
    doNotStartYet: undefined as undefined,
  };

  const history = ctx.recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `Compact memory:
${JSON.stringify(memory, null, 2)}

Recent messages:
${history || "(none)"}

User:
${ctx.userInstruction}

Return JSON:
{
  "assistantReply": "natural reply",
  "intent": "chat",
  "requiresConfirmation": false,
  "clarificationQuestion": null,
  "memoryPatch": { "story": {}, "characters": [], "relationships": [], "writingRules": [], "preferences": {}, "remove": [] },
  "action": { "type": "none", "payload": {} },
  "suggestions": []
}`;
}
