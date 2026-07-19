import "server-only";

import { AIError } from "@/lib/ai/errors";
import { logAiEvent } from "@/lib/ai/logger";
import { getAIProvider } from "@/lib/ai/registry";
import { countWords } from "@/lib/ai/token-estimator";
import type { AIProvider } from "@/lib/ai/types";
import { getAiEnv, resolveCreativeModel } from "@/lib/env";

export type CreativeTextResult = {
  text: string;
  title: string;
  content: string;
  wordCount: number;
  provider: string;
  model: string;
  durationMs: number;
  retryCount: number;
};

/** True if the model dumped a JSON tool envelope instead of prose. */
export function looksLikeJsonDump(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    // Known accidental wrappers — extract later; still "json dump"
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      ("assistantReply" in parsed ||
        "memoryPatch" in parsed ||
        "action" in parsed ||
        "content" in parsed)
    );
  } catch {
    return t.includes('"assistantReply"') || t.includes('"memoryPatch"');
  }
}

/**
 * If the provider wrapped prose in a known JSON field, extract it safely.
 * Otherwise return null (do not run extraction validation).
 */
export function extractProseFromAccidentalJson(raw: string): string | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    for (const key of ["content", "scene", "draft", "text", "prose"]) {
      if (typeof parsed[key] === "string" && String(parsed[key]).trim().length > 40) {
        return String(parsed[key]).trim();
      }
    }
    // Never treat assistantReply as the scene body if it looks like a short chat reply
    if (
      typeof parsed.assistantReply === "string" &&
      String(parsed.assistantReply).trim().length > 200 &&
      !looksLikeFieldAsk(String(parsed.assistantReply))
    ) {
      return String(parsed.assistantReply).trim();
    }
  } catch {
    return null;
  }
  return null;
}

function looksLikeFieldAsk(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("working title") ||
    (lower.includes("genre") && lower.includes("language"))
  );
}

export function parseTitleBody(raw: string): { title: string; content: string } {
  const text = raw.trim();
  const match = text.match(/^TITLE:\s*(.+)\s*\n---\s*\n([\s\S]+)$/i);
  if (match) {
    return { title: match[1].trim().slice(0, 160), content: match[2].trim() };
  }
  const lines = text.split("\n");
  const first = (lines[0] || "").trim();
  if (first.length > 0 && first.length <= 80 && lines.length > 2) {
    return {
      title: first.replace(/^#+\s*/, "").slice(0, 160),
      content: lines.slice(1).join("\n").trim() || text,
    };
  }
  return { title: "Untitled scene", content: text };
}

export function validateCreativeProse(
  raw: string,
  opts?: { minChars?: number }
): { title: string; content: string; wordCount: number } {
  let text = raw.trim();
  if (!text) {
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "I couldn’t generate that scene correctly. Please retry.",
      true
    );
  }

  if (looksLikeJsonDump(text)) {
    const extracted = extractProseFromAccidentalJson(text);
    if (!extracted) {
      throw new AIError(
        "AI_INVALID_RESPONSE",
        "I couldn’t generate that scene correctly. Please retry.",
        true
      );
    }
    text = extracted;
  }

  const parsed = parseTitleBody(text);
  const minChars = opts?.minChars ?? 120;
  if (parsed.content.trim().length < minChars) {
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "I couldn’t generate that scene correctly. Please retry.",
      true
    );
  }

  return {
    title: parsed.title,
    content: parsed.content,
    wordCount: countWords(parsed.content),
  };
}

/**
 * Plain-text creative generation. Never uses JSON response_format.
 * Empty response → one retry. No JSON schema repair.
 */
export async function generateCreativeText(params: {
  systemInstruction: string;
  prompt: string;
  operation: string;
  temperature?: number;
  maxOutputTokens?: number;
  provider?: AIProvider;
}): Promise<CreativeTextResult> {
  const env = getAiEnv();
  const model = resolveCreativeModel(env);
  const provider = params.provider ?? getAIProvider();
  let retryCount = 0;

  logAiEvent("info", "ai.creative_text.start", {
    operation: params.operation,
    provider: provider.name,
    model,
    outputMode: "text",
  });

  const call = async () =>
    provider.generateText({
      systemInstruction: params.systemInstruction,
      prompt: params.prompt,
      temperature: params.temperature ?? 0.85,
      maxOutputTokens: params.maxOutputTokens ?? 4096,
      model,
      operation: params.operation,
      outputMode: "text",
    });

  let result = await call();
  if (!result.text.trim()) {
    retryCount = 1;
    result = await call();
  }

  const validated = validateCreativeProse(result.text);

  logAiEvent("info", "ai.creative_text.ok", {
    operation: params.operation,
    provider: result.provider,
    model: result.model,
    outputMode: "text",
    durationMs: result.durationMs,
    responseLength: result.text.length,
    retryCount,
    validation: "ok",
  });

  return {
    text: result.text,
    title: validated.title,
    content: validated.content,
    wordCount: validated.wordCount,
    provider: result.provider,
    model: result.model,
    durationMs: result.durationMs,
    retryCount,
  };
}
