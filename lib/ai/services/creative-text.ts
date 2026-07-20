import "server-only";

import { AIError } from "@/lib/ai/errors";
import { generateWithFailover } from "@/lib/ai/failover";
import { logAiEvent } from "@/lib/ai/logger";
import { assessHinglishQuality } from "@/lib/ai/quality/hinglish-quality";
import { NATURAL_HINGLISH_PROMPT } from "@/lib/ai/quality/hinglish-quality";
import {
  assessOutputIntegrity,
  mergePartialCreative,
} from "@/lib/ai/quality/output-integrity";
import { countWords } from "@/lib/ai/token-estimator";
import type { AIProvider } from "@/lib/ai/types";
import {
  checkLanguageCompliance,
  formatLanguagePromptBlock,
  type LanguagePreferences,
} from "@/lib/story-agent/language-preferences";
import { StoryAgentError } from "@/lib/story-agent/errors";
import { CREATIVE_FAILURE_USER_MESSAGE } from "@/lib/story-agent/concept-reply";

export type CreativeTextResult = {
  text: string;
  title: string;
  content: string;
  wordCount: number;
  provider: string;
  model: string;
  durationMs: number;
  retryCount: number;
  languageComplianceRetry?: boolean;
  integrityRetry?: boolean;
  finishReason?: string;
};

/** True if the model dumped a JSON tool envelope instead of prose. */
export function looksLikeJsonDump(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
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

export function extractProseFromAccidentalJson(raw: string): string | null {
  const t = raw.trim();
  if (!t.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(t) as Record<string, unknown>;
    for (const key of ["content", "scene", "draft", "text", "prose"]) {
      if (
        typeof parsed[key] === "string" &&
        String(parsed[key]).trim().length > 40
      ) {
        return String(parsed[key]).trim();
      }
    }
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
 * Empty response → one retry. Language miss → one stricter retry.
 * No JSON schema repair.
 */
export async function generateCreativeText(params: {
  systemInstruction: string;
  prompt: string;
  operation: string;
  temperature?: number;
  maxOutputTokens?: number;
  provider?: AIProvider;
  languagePrefs?: LanguagePreferences;
  turnRequestId?: string;
}): Promise<CreativeTextResult> {
  let retryCount = 0;
  let languageComplianceRetry = false;

  logAiEvent("info", "ai.creative_text.start", {
    operation: params.operation,
    outputMode: "text",
    narrationLanguage: params.languagePrefs?.narrationLanguage,
    dialogueLanguage: params.languagePrefs?.dialogueLanguage,
  });

  const call = async (system: string, prompt: string) =>
    generateWithFailover({
      modelKind: "creative",
      providerOverride: params.provider,
      turnRequestId: params.turnRequestId,
      input: {
        systemInstruction: system,
        prompt,
        temperature: params.temperature ?? 0.85,
        maxOutputTokens: params.maxOutputTokens ?? 8192,
        operation: params.operation,
        outputMode: "text",
      },
    });

  let result = await call(params.systemInstruction, params.prompt);
  if (!result.text.trim()) {
    retryCount = 1;
    result = await call(params.systemInstruction, params.prompt);
  }
  if (!result.text.trim()) {
    throw new StoryAgentError(
      "CREATIVE_RESPONSE_EMPTY",
      CREATIVE_FAILURE_USER_MESSAGE,
      { retryable: true, operation: params.operation }
    );
  }

  let integrityRetry = false;
  let integrity = assessOutputIntegrity({
    text: result.text,
    finishReason: result.finishReason,
  });
  if (!integrity.ok && integrity.truncated) {
    integrityRetry = true;
    retryCount += 1;
    const partial = result.text;
    const cont = await call(
      params.systemInstruction,
      `${params.prompt}

The previous draft was truncated mid-output. Continue ONLY from where it stopped. Do not repeat earlier paragraphs.

PARTIAL DRAFT:
${partial.slice(-2500)}

Continue seamlessly:`
    );
    result = {
      ...cont,
      text: mergePartialCreative(partial, cont.text),
    };
    integrity = assessOutputIntegrity({
      text: result.text,
      finishReason: cont.finishReason,
    });
    logAiEvent("info", "ai.creative_text.integrity_retry", {
      operation: params.operation,
      integrityRetry: true,
      reason: integrity.reason,
      finishReason: result.finishReason,
    });
    if (!integrity.ok && integrity.truncated) {
      throw new StoryAgentError(
        "CREATIVE_RESPONSE_TRUNCATED",
        CREATIVE_FAILURE_USER_MESSAGE,
        { retryable: true, operation: params.operation }
      );
    }
  }

  let validated = validateCreativeProse(result.text);

  if (params.languagePrefs) {
    const compliance = checkLanguageCompliance(
      validated.content,
      params.languagePrefs
    );
    const needsHinglish =
      params.languagePrefs.narrationLanguage === "hinglish" ||
      params.languagePrefs.dialogueLanguage === "hinglish";
    const hinglishQ = needsHinglish
      ? assessHinglishQuality(validated.content)
      : { ok: true, reason: "skip", formalHits: 0 };

    if (!compliance.ok || !hinglishQ.ok) {
      languageComplianceRetry = true;
      retryCount += 1;
      const reminder = `

STRICT LANGUAGE / STYLE REMINDER:
${formatLanguagePromptBlock(params.languagePrefs)}
${needsHinglish ? NATURAL_HINGLISH_PROMPT : ""}
Avoid overly formal/shuddh Hindi. Rewrite the entire scene naturally. Prose only.`;
      result = await call(
        params.systemInstruction,
        `${params.prompt}${reminder}`
      );
      validated = validateCreativeProse(result.text);
      logAiEvent("info", "ai.creative_text.language_retry", {
        operation: params.operation,
        languageComplianceRetry: true,
        reason: !compliance.ok ? compliance.reason : hinglishQ.reason,
        narrationLanguage: params.languagePrefs.narrationLanguage,
        dialogueLanguage: params.languagePrefs.dialogueLanguage,
      });
    }
  }

  logAiEvent("info", "ai.creative_text.ok", {
    operation: params.operation,
    provider: result.provider,
    model: result.model,
    outputMode: "text",
    durationMs: result.durationMs,
    responseLength: result.text.length,
    retryCount,
    languageComplianceRetry,
    integrityRetry,
    finishReason: result.finishReason,
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
    languageComplianceRetry,
    integrityRetry,
    finishReason: result.finishReason,
  };
}
