/**
 * Attempt timeout with AbortController (Phase F).
 */

export async function withAttemptTimeout<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (parent) {
    if (parent.aborted) {
      controller.abort();
    } else {
      parent.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        Object.assign(new Error("PROVIDER_TIMEOUT"), {
          code: "PROVIDER_TIMEOUT",
          retryable: true,
          fallbackAllowed: true,
          provider: "unknown",
          message: "Provider attempt timed out",
          statusCode: null,
        })
      );
    }, Math.max(100, ms));
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (parent) parent.removeEventListener("abort", onParentAbort);
  }
}

export function remainingDeadlineMs(
  startedAt: number,
  totalDeadlineMs: number
): number {
  return Math.max(0, totalDeadlineMs - (Date.now() - startedAt));
}
