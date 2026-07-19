/**
 * Creative output integrity — truncation / mid-word cuts.
 */

export type FinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "unknown"
  | string;

export type OutputIntegrityResult = {
  ok: boolean;
  truncated: boolean;
  endsMidWord: boolean;
  endsAbruptly: boolean;
  reason: string;
  finishReason?: FinishReason;
};

function endsWithIncompleteWord(text: string): boolean {
  const t = text.trimEnd();
  if (!t) return false;
  // Ends with alphanumeric and no terminal punctuation / closing quote
  if (/[A-Za-z0-9]$/.test(t) && !/[.!?…”"')\]]\s*$/.test(t)) {
    // Allow short complete words at paragraph end if prior char is space and word is common
    const last = t.split(/\s+/).pop() || "";
    // Mid-word cut often leaves very short fragments or hyphenated stubs
    if (last.length <= 2 && /[a-z]/i.test(last)) return true;
    // No sentence terminator and last token looks truncated (ends with consonant cluster oddity)
    if (!/[.!?]$/.test(t) && last.length >= 3 && /[A-Za-z]{3,}$/.test(last)) {
      // Heuristic: unfinished if no sentence end and last line is short abruptly
      const lines = t.split("\n").filter((l) => l.trim());
      const lastLine = lines[lines.length - 1] || "";
      if (lastLine.trim().split(/\s+/).length <= 3 && !/[.!?]$/.test(lastLine)) {
        return true;
      }
    }
  }
  return false;
}

export function assessOutputIntegrity(params: {
  text: string;
  finishReason?: FinishReason | null;
  minChars?: number;
}): OutputIntegrityResult {
  const text = params.text.trim();
  const finish = (params.finishReason || "unknown").toLowerCase();
  const truncatedByFinish =
    finish === "length" || finish === "max_tokens" || finish === "max_tokens";

  if (!text) {
    return {
      ok: false,
      truncated: true,
      endsMidWord: false,
      endsAbruptly: true,
      reason: "empty",
      finishReason: finish,
    };
  }

  const midWord = endsWithIncompleteWord(text);
  const endsAbruptly =
    truncatedByFinish ||
    midWord ||
    (/[A-Za-z0-9,-]$/.test(text) && !/[.!?…"')\]]\s*$/.test(text));

  if (truncatedByFinish || midWord) {
    return {
      ok: false,
      truncated: true,
      endsMidWord: midWord,
      endsAbruptly,
      reason: truncatedByFinish ? "finish_length" : "mid_word",
      finishReason: finish,
    };
  }

  const minChars = params.minChars ?? 80;
  if (text.length < minChars) {
    return {
      ok: false,
      truncated: false,
      endsMidWord: false,
      endsAbruptly: true,
      reason: "too_short",
      finishReason: finish,
    };
  }

  return {
    ok: true,
    truncated: false,
    endsMidWord: false,
    endsAbruptly: false,
    reason: "ok",
    finishReason: finish,
  };
}

/** Append continuation without duplicating overlapping prefix/suffix. */
export function mergePartialCreative(
  partial: string,
  continuation: string
): string {
  const a = partial.trimEnd();
  const b = continuation.trimStart();
  if (!a) return b;
  if (!b) return a;
  // If continuation repeats the end of partial, strip overlap
  const max = Math.min(a.length, b.length, 200);
  for (let n = max; n >= 20; n -= 1) {
    if (a.slice(-n) === b.slice(0, n)) {
      return `${a}${b.slice(n)}`;
    }
  }
  return `${a}\n\n${b}`;
}
