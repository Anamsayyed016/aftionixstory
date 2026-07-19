import {
  evaluateStoryCompleteness,
  normalizeChatStoryDraft,
  parseChatCreateExtraction,
  type NormalizedChatStoryDraft,
} from "@/lib/chat/create-story-extraction";
import { AIError, isAIError } from "@/lib/ai/errors";
import type { AIProvider } from "@/lib/ai/types";
import { getAiEnv } from "@/lib/env";
import type { CreateStoryWizardInput } from "@/lib/validations/story";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatCreateStoryResult = {
  assistantReply: string;
  status: "complete" | "needs_more_info";
  missing: string[];
  story: NormalizedChatStoryDraft;
  wizardInput: CreateStoryWizardInput | null;
  provider: string;
  model: string;
};

const SYSTEM_INSTRUCTION = `You are a professional fiction editor helping a writer design a serialized story for StoryVerse AI.

Rules:
- Never write episode prose or a finished story manuscript.
- Your job is to collect story setup information conversationally.
- Ask natural follow-up questions when details are missing.
- Never invent critical facts the writer has not provided (names, major plot twists, relationships).
- You may propose light options, but clearly mark them as suggestions the writer can reject.
- Always respond with JSON only. No markdown outside JSON. No commentary outside JSON.

Collect when possible:
title, synopsis/description, genre, language, tone, setting, target audience, POV, writing style, pacing, themes, plot, characters, relationships, writing rules.

Return exactly this JSON shape:
{
  "status": "complete" | "needs_more_info",
  "missing": ["field names still needed"],
  "assistantReply": "short natural message to the writer",
  "story": {
    "title": "",
    "description": "",
    "genre": "",
    "language": "",
    "tone": "",
    "setting": "",
    "targetAudience": "",
    "pov": "",
    "writingStyle": "",
    "pacing": "",
    "themes": [],
    "plot": "",
    "characters": [
      {
        "clientId": "c1",
        "name": "",
        "role": "",
        "personality": "",
        "age": null,
        "gender": "",
        "appearance": "",
        "background": "",
        "speakingStyle": "",
        "secrets": "",
        "emotionalState": ""
      }
    ],
    "relationships": [
      {
        "sourceClientId": "c1",
        "targetClientId": "c2",
        "relationshipType": "",
        "description": ""
      }
    ],
    "writingRules": [
      { "rule": "", "category": "style", "priority": 5, "isActive": true }
    ]
  }
}

Status "complete" only when title, genre, language, and at least one character (name, role, personality) are confidently known from the writer.
Keep assistantReply concise and collaborative.`;

function buildUserPrompt(params: {
  messages: ChatTurn[];
  currentStory?: NormalizedChatStoryDraft | null;
}): string {
  const history = params.messages
    .slice(-16)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const draftBlock = params.currentStory
    ? `\nCurrent editable draft (may include writer edits):\n${JSON.stringify(params.currentStory, null, 2)}\n`
    : "\nNo draft captured yet.\n";

  return `Conversation so far:
${history}
${draftBlock}
Return the next JSON extraction now.`;
}

function mergeDrafts(
  previous: NormalizedChatStoryDraft | null | undefined,
  next: NormalizedChatStoryDraft
): NormalizedChatStoryDraft {
  if (!previous) return next;
  return {
    ...previous,
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => {
        if (value == null) return false;
        if (typeof value === "string" && value.trim() === "") return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
    ),
    characters:
      next.characters.length > 0 ? next.characters : previous.characters,
    relationships:
      next.relationships.length > 0
        ? next.relationships
        : previous.relationships,
    writingRules:
      next.writingRules.length > 0
        ? next.writingRules
        : previous.writingRules,
  };
}

async function generateExtractionText(
  provider: AIProvider,
  messages: ChatTurn[],
  currentStory: NormalizedChatStoryDraft | null | undefined,
  repairHint?: string
) {
  const env = getAiEnv();
  const prompt = `${buildUserPrompt({ messages, currentStory })}${
    repairHint
      ? `\n\nPrevious output was invalid. Fix and return valid JSON only.\nError: ${repairHint}`
      : ""
  }`;

  return provider.generateText({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.4,
    maxOutputTokens: 4096,
    model: env.GEMINI_STORY_MODEL,
  });
}

export async function runChatCreateStoryTurn(params: {
  messages: ChatTurn[];
  currentStory?: NormalizedChatStoryDraft | null;
  provider?: AIProvider;
}): Promise<ChatCreateStoryResult> {
  if (params.messages.length === 0) {
    throw new AIError(
      "AI_REQUEST_FAILED",
      "Send a message to start the story assistant.",
      false
    );
  }

  const provider =
    params.provider ?? (await import("@/lib/ai/registry")).getAIProvider();
  let rawText = "";
  let providerName = provider.name;
  let model = "";

  try {
    const first = await generateExtractionText(
      provider,
      params.messages,
      params.currentStory
    );
    rawText = first.text;
    providerName = first.provider;
    model = first.model;
  } catch (error) {
    if (isAIError(error)) throw error;
    throw new AIError(
      "AI_REQUEST_FAILED",
      "The story assistant could not reach the AI provider.",
      true
    );
  }

  let extraction;
  try {
    extraction = parseChatCreateExtraction(rawText);
  } catch {
    try {
      const retry = await generateExtractionText(
        provider,
        params.messages,
        params.currentStory,
        "Response was not valid JSON matching the required schema."
      );
      rawText = retry.text;
      providerName = retry.provider;
      model = retry.model;
      extraction = parseChatCreateExtraction(rawText);
    } catch {
      throw new AIError(
        "AI_INVALID_RESPONSE",
        "The assistant returned an unreadable response. Please try again.",
        true
      );
    }
  }

  const normalized = normalizeChatStoryDraft(extraction.story);
  const merged = mergeDrafts(params.currentStory, normalized);
  const evaluated = evaluateStoryCompleteness(merged);

  const missing = Array.from(
    new Set([...(extraction.missing ?? []), ...evaluated.missing])
  );

  return {
    assistantReply: extraction.assistantReply,
    status: evaluated.status,
    missing,
    story: merged,
    wizardInput: evaluated.wizardInput,
    provider: providerName,
    model,
  };
}
