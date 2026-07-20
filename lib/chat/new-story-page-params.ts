import { sanitizeStarterPrompt } from "@/lib/create/story-starters";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";
import type { NewStoryEntryMode } from "@/lib/chat/types";

export type NewStoryPageSearchParams = {
  mode?: string | string[];
  prompt?: string | string[];
};

function firstParam(
  value: string | string[] | undefined
): string | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Canonical server-side parse for /stories/new query values.
 * Client must initialize from these props — never from sticky module state
 * or a divergent first-pass useSearchParams read.
 */
export function parseNewStoryPageParams(
  raw: NewStoryPageSearchParams | null | undefined
): {
  mode: NewStoryEntryMode;
  prompt: string;
} {
  const modeRaw = firstParam(raw?.mode);
  const promptRaw = firstParam(raw?.prompt);
  return {
    mode: parseNewStoryEntryMode(modeRaw),
    prompt: sanitizeStarterPrompt(promptRaw),
  };
}
