import "server-only";

import { AIError } from "@/lib/ai/errors";
import { logAiEvent } from "@/lib/ai/logger";
import { getAIProvider } from "@/lib/ai/registry";
import { countWords } from "@/lib/ai/token-estimator";
import { getAiEnv, resolveStoryModel } from "@/lib/env";
import type { StoryMemory } from "@/lib/story-agent/schema";
import {
  assertGenerationRateLimit,
  assertWithinGenerationLimit,
  incrementSuccessfulGeneration,
} from "@/lib/usage/generation";

export type ConversationalDraftResult = {
  title: string;
  content: string;
  wordCount: number;
  clientRequestId: string;
  provider: string;
  model: string;
  durationMs: number;
  action: "NEW_EPISODE" | "REGENERATE" | "CONTINUE";
};

function buildOpeningPrompt(params: {
  memory: StoryMemory;
  userInstruction: string;
  reviseContent?: string | null;
}): { system: string; prompt: string } {
  const sm = params.memory.storyMemory;
  const chars = params.memory.characters
    .map((c) => {
      const bits = [
        c.name,
        c.role ? `(${c.role})` : "",
        c.personality?.length ? `personality: ${c.personality.join(", ")}` : "",
        c.avoid?.length ? `avoid: ${c.avoid.join(", ")}` : "",
      ].filter(Boolean);
      return `- ${bits.join(" — ")}`;
    })
    .join("\n");

  const rels = params.memory.relationships
    .map((r) => `- ${r.from} → ${r.to}: ${r.type}${r.notes ? ` (${r.notes})` : ""}`)
    .join("\n");

  const rules = params.memory.writingRules.map((r) => `- ${r.rule}`).join("\n");
  const prefs = params.memory.userPreferences;

  const system = `You are StoryVerse's fiction writer. Write vivid serialized episode prose.

Rules:
- Write the opening episode / scene the user asked for.
- Use only established facts from memory. Do not invent major new relationships without need.
- Mirror the user's language (English / Hindi / Hinglish).
- Prefer third-person unless memory says otherwise.
- Keep pacing readable for web serialization.
- If loud dialogue is requested, use UPPERCASE sparingly for shouted lines.
- Return plain text only in this format:

TITLE: <episode title>
---
<body prose>`;

  const prompt = `Story memory:
Title/concept: ${sm.title || sm.concept || "Untitled Story"}
Genre: ${(sm.genre ?? []).join(", ") || "unspecified"}
Tone: ${(sm.tone ?? []).join(", ") || "unspecified"}
Setting: ${sm.setting || "unspecified"}
Plot notes: ${sm.plot || "none"}
Language hint: ${sm.language || prefs.dialogueLanguage || "mirror user"}
POV: ${sm.pov || "third person"}
Pacing: ${sm.pacing || (prefs.slowBurn ? "slow burn" : "balanced")}

Characters:
${chars || "- (derive carefully from instruction)"}

Relationships:
${rels || "- none stored"}

Writing rules:
${rules || "- none stored"}

Preferences:
- uppercase loud dialogue: ${prefs.uppercaseForLoudDialogue ? "yes" : "no"}
- avoid: ${(prefs.avoid ?? []).join(", ") || "none"}

User instruction:
${params.userInstruction}

${
  params.reviseContent
    ? `Previous draft to revise:\n${params.reviseContent.slice(0, 6000)}\n`
    : ""
}

Write Episode 1 / the requested draft now.`;

  return { system, prompt };
}

function parseTitleBody(raw: string): { title: string; content: string } {
  const text = raw.trim();
  const match = text.match(/^TITLE:\s*(.+)\s*\n---\s*\n([\s\S]+)$/i);
  if (match) {
    return { title: match[1].trim().slice(0, 160), content: match[2].trim() };
  }
  const lines = text.split("\n");
  const title = (lines[0] || "Episode 1").replace(/^#+\s*/, "").slice(0, 160);
  const content = lines.slice(1).join("\n").trim() || text;
  return { title, content };
}

/**
 * Creative opening/revision draft WITHOUT requiring a Story DB row.
 * Uses the story-generation model profile (not the agent model).
 */
export async function generateConversationalDraft(params: {
  userId: string;
  memory: StoryMemory;
  userInstruction: string;
  clientRequestId: string;
  reviseExistingContent?: string | null;
}): Promise<ConversationalDraftResult> {
  await assertWithinGenerationLimit(params.userId);
  await assertGenerationRateLimit(params.userId);

  const env = getAiEnv();
  const model = resolveStoryModel(env);
  const provider = getAIProvider();
  const { system, prompt } = buildOpeningPrompt({
    memory: params.memory,
    userInstruction: params.userInstruction,
    reviseContent: params.reviseExistingContent,
  });

  logAiEvent("info", "ai.story_agent.creative_draft", {
    operation: "story_agent_opening_draft",
    provider: provider.name,
    model,
    requestId: params.clientRequestId,
  });

  const result = await provider.generateText({
    systemInstruction: system,
    prompt,
    temperature: 0.85,
    maxOutputTokens: 4096,
    model,
    operation: "story_agent_opening_draft",
  });

  const parsed = parseTitleBody(result.text);
  if (parsed.content.trim().length < 80) {
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "The story draft came back too short. Please try again.",
      true
    );
  }

  await incrementSuccessfulGeneration(params.userId);

  return {
    title: parsed.title || "Episode 1",
    content: parsed.content,
    wordCount: countWords(parsed.content),
    clientRequestId: params.clientRequestId,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    action: params.reviseExistingContent ? "REGENERATE" : "NEW_EPISODE",
  };
}

export function hasUsableWritingContext(memory: StoryMemory): boolean {
  const sm = memory.storyMemory;
  return Boolean(
    (sm.concept && sm.concept.trim().length >= 3) ||
      (sm.title && sm.title.trim().length >= 3) ||
      (sm.plot && sm.plot.trim().length >= 8) ||
      memory.characters.length > 0 ||
      memory.relationships.length > 0
  );
}
