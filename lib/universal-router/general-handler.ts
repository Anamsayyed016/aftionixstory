/**
 * Lightweight General AI path — Provider Router v2 only, no story memory/prompts.
 */

import "server-only";

import {
  joinLayers,
  platformIdentity,
} from "@/lib/prompt-registry/layers";
import { generateTextCompat } from "@/lib/provider-router/v2/legacy-generate";
import type { UniversalIntent } from "@/lib/universal-router/intents";
import { mirrorUserLanguageStyle } from "@/lib/universal-router/language-mirror";

export type GeneralAiTurnResult = {
  assistantReply: string;
  provider?: string;
  model?: string;
  durationMs?: number;
  enableWebSearch: boolean;
};

function systemForIntent(intent: UniversalIntent): string {
  const base = [
    platformIdentity(),
    mirrorUserLanguageStyle(),
    "You are the AFTIONIX Studio assistant. Answer helpfully and concisely.",
    "Do not invent story characters or force the reply into story setup unless the user asks.",
  ];

  switch (intent) {
    case "coding_help":
      base.push(
        "Focus on programming help: clear explanations, small examples when useful, and practical next steps."
      );
      break;
    case "current_information":
      base.push(
        "Use live web search / grounding results when available. Summarize what you find in plain language; cite sources casually in text if helpful. Do not invent live facts."
      );
      break;
    case "platform_question":
      base.push(
        "Answer about AFTIONIX / StoryVerse as a creative studio assistant.",
        "A full product Knowledge Base / RAG is not available yet — be honest when you are unsure about exact product internals, and do not invent billing or feature details.",
        "Never route the user into filling story setup fields for a platform question."
      );
      break;
    case "unclear":
      base.push(
        "The user's message is ambiguous. Ask ONE short clarifying question about whether they want story help, a general answer, coding help, or current information. Do not guess a story slot."
      );
      break;
    default:
      base.push(
        "Answer as a capable general assistant. Prefer accuracy over speculation."
      );
  }

  return joinLayers(base);
}

export async function runGeneralAiTurn(params: {
  userMessage: string;
  intent: UniversalIntent;
  enableWebSearch?: boolean;
  turnRequestId?: string;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<GeneralAiTurnResult> {
  const enableWebSearch =
    params.enableWebSearch === true || params.intent === "current_information";

  const recent =
    params.recentMessages
      ?.slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n") || "";

  const prompt = [
    recent ? `Recent conversation:\n${recent}\n` : "",
    `User message:\n${params.userMessage.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateTextCompat({
    modelKind: "agent",
    turnRequestId: params.turnRequestId,
    input: {
      systemInstruction: systemForIntent(params.intent),
      prompt,
      temperature: params.intent === "coding_help" ? 0.3 : 0.6,
      maxOutputTokens: 1200,
      outputMode: "text",
      operation: `universal_${params.intent}`,
      enableWebSearch,
    },
  });

  return {
    assistantReply: result.text.trim(),
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    enableWebSearch,
  };
}
