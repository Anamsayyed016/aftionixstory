/**
 * JSON output parse + optional single repair (Phase F).
 */

import type { z } from "zod";
import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import { makeProviderError, type ProviderError } from "@/lib/provider-router/v2/errors";

export type JsonParseResult =
  | { ok: true; value: unknown; text: string }
  | { ok: false; error: ProviderError; text: string };

export function parseProviderJson(raw: string): JsonParseResult {
  const text = (raw || "").trim();
  if (!text) {
    return {
      ok: false,
      text,
      error: makeProviderError({
        code: "PROVIDER_EMPTY_OUTPUT",
        provider: "unknown",
        retryable: true,
        fallbackAllowed: true,
        message: "Empty JSON output",
      }),
    };
  }

  let candidate = text;
  try {
    const extracted = extractJsonObject(text);
    if (extracted) {
      candidate =
        typeof extracted === "string" ? extracted : JSON.stringify(extracted);
    }
  } catch {
    // fall through to direct JSON.parse
  }

  try {
    const value =
      typeof candidate === "string" ? JSON.parse(candidate) : candidate;
    return {
      ok: true,
      value,
      text: typeof candidate === "string" ? candidate : text,
    };
  } catch {
    return {
      ok: false,
      text: typeof candidate === "string" ? candidate : text,
      error: makeProviderError({
        code: "PROVIDER_MALFORMED_JSON",
        provider: "unknown",
        retryable: false,
        fallbackAllowed: true,
        message: "Malformed JSON from provider",
      }),
    };
  }
}

export function validateJsonWithSchema<T>(
  value: unknown,
  schema: z.ZodType<T>
): { ok: true; value: T } | { ok: false; error: ProviderError } {
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    error: makeProviderError({
      code: "PROVIDER_MALFORMED_JSON",
      provider: "unknown",
      retryable: false,
      fallbackAllowed: true,
      message: "JSON failed schema validation",
    }),
  };
}

export function buildJsonRepairUserPrompt(params: {
  schemaHint: string;
  invalidText: string;
}): string {
  return `STRICT REPAIR: Return valid JSON only matching this shape:
${params.schemaHint}

Invalid previous output:
${params.invalidText.slice(0, 2000)}

No markdown fences. No commentary.`;
}
