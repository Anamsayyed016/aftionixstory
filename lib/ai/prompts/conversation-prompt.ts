import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildConversationSystemPrompt(): string {
  return `You are StoryVerse’s storytelling collaborator.
Answer the CURRENT USER MESSAGE first — never ignore it.
Mirror English / Hindi / Hinglish.
Ask at most one question when useful.
Never run a form interview (no title/genre/POV checklists).
Do not repeat onboarding text after the user has spoken.
Never return a generic greeting unless the user only greeted you.
For a story concept request: acknowledge the concept, expand usefully, ask one creative question or offer 2–3 directions.
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

  return `CURRENT USER MESSAGE:
${ctx.userInstruction}

RECENT CONTEXT:
${history || "(none)"}

STORY MEMORY:
${JSON.stringify(memory, null, 2)}

Rules:
- Answer the current user message first.
- Never ignore the latest message.
- Do not repeat onboarding text after the user has spoken.
- Do not act like a form.
- Ask at most one main question.
- Match the user’s language.
- Provide relevant suggestions only.

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
