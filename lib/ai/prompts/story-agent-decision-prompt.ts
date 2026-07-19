import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

/** Fallback structured classifier when deterministic routing is ambiguous. */
export function buildStoryAgentDecisionPrompt(ctx: CompactStoryContext): {
  system: string;
  prompt: string;
} {
  const system = `You are StoryVerse Story Agent — decide intent and memory updates.
LAYER 1 assistantReply: natural conversation, never a field checklist.
LAYER 2: JSON envelope only.
If the user asked to WRITE a scene/story, set action.type to "generate_episode"
but keep assistantReply short (the server will generate prose separately).
Never put full scene prose inside assistantReply.
Never invent checklist questions for title/genre/POV/language.`;

  const prompt = `Operation hint: ${ctx.operation}
Compact memory:
${JSON.stringify(
  {
    concept: ctx.concept,
    title: ctx.title,
    genre: ctx.genre,
    characters: ctx.characters,
    relationships: ctx.relationships,
    prefs: ctx.preferences,
    hasDraft: Boolean(ctx.latestDraftPreview),
  },
  null,
  2
)}

Recent:
${ctx.recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n") || "(none)"}

User:
${ctx.userInstruction}

JSON only:
{
  "assistantReply": "...",
  "intent": "chat|update_story|brainstorm|start_story|generate_episode|revise_episode|...",
  "requiresConfirmation": false,
  "clarificationQuestion": null,
  "memoryPatch": { "story": {}, "characters": [], "relationships": [], "writingRules": [], "preferences": {}, "remove": [] },
  "action": { "type": "none|generate_episode|revise_draft|suggest_options|create_story|show_review|save_episode", "payload": {} },
  "suggestions": []
}`;

  return { system, prompt };
}
