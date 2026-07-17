import "server-only";

import { AIError } from "@/lib/ai/errors";

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    throw new AIError("AI_TIMEOUT", "The AI request was aborted.", false);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AIError("AI_TIMEOUT", "The AI request timed out.", true));
        }, timeoutMs);

        if (signal) {
          onAbort = () => {
            reject(new AIError("AI_TIMEOUT", "The AI request was aborted.", false));
          };
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }
}
