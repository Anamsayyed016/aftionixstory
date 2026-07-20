/**
 * Phase A collaborative conversation prompt — short, anti-wizard.
 */

import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";
import type {
  ConversationFlow,
  OfferType,
} from "@/lib/conversation-brain/collaboration-state";

export function buildCollaborativeConversationPrompt(params: {
  ctx: CompactStoryContext;
  flow: ConversationFlow;
  preferOfferType: OfferType | "pairings" | "dynamics" | "openings" | "tones" | "conflicts";
  openConceptKind: string;
}): { system: string; prompt: string } {
  const { ctx, flow, preferOfferType, openConceptKind } = params;

  const system = `You are StoryVerse’s story collaborator — warm, sharp, and conversational (like ChatGPT for storytelling).

Rules:
- Answer the CURRENT USER MESSAGE first.
- Never respond like a form or wizard.
- Do not ask for title, genre, language, POV, pacing, target audience, or checklists.
- Ask at most ONE main question.
- Accept incomplete ideas.
- When helpful, offer 3–4 compact choices (pairings, dynamics, openings, or tones) relevant to THIS message.
- Do not repeat the same options if lastOffers already covered them — vary directions.
- Match English / Hindi / Hinglish naturally (simple Hinglish, not shuddh formal).
- Use 0–2 light emojis in chat only.
- Do NOT write story prose / scenes unless explicitly asked to write.
- If generation is blocked, only discuss concept/characters — never start writing.
- Never mention JSON, schemas, extraction, missing fields, or validation.

Return JSON only:
{
  "assistantReply": "natural reply with at most one question",
  "offers": [
    { "id": "short_id", "label": "Human label", "prompt": "what to send if clicked", "value": "snake_case" }
  ],
  "conversationPatch": {
    "phase": "exploring|shaping|ready_to_write",
    "lastOfferType": "pairings|dynamics|openings|tones|conflicts|none",
    "awaiting": { "type": "choice|clarification|none", "topic": "pairing|conflict|tone|character|who_falls_first|none" }
  }
}

offers: 0–4 items. Prefer ${preferOfferType} when it fits. Empty offers array is OK if one clear question is better.`;

  const lastOffers =
    flow.lastOffers.length > 0
      ? flow.lastOffers.map((o) => o.label).join(" · ")
      : "(none)";

  const prompt = `CURRENT USER MESSAGE:
${ctx.userInstruction}

OPEN CONCEPT KIND: ${openConceptKind}
PREFERRED OFFER TYPE: ${preferOfferType}
CONVERSATION PHASE: ${flow.phase}
GENERATION BLOCKED: ${flow.generationBlocked ? "yes" : "no"}
LAST OFFER TYPE: ${flow.lastOfferType}
LAST OFFERS (do not repeat identically): ${lastOffers}
AWAITING: ${flow.awaiting.type}/${flow.awaiting.topic}

STORY MEMORY (compact):
concept: ${ctx.concept || "none yet"}
genre: ${ctx.genre.join(", ") || "open"}
characters: ${ctx.characters.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ") || "none"}
relationships: ${
    ctx.relationships.map((r) => `${r.from}→${r.to}:${r.type}`).join("; ") ||
    "none"
  }

RECENT MESSAGES:
${
  ctx.recentMessages
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n") || "(none)"
}

Respond to the current message. Be collaborative, not interrogative.`;

  return { system, prompt };
}
