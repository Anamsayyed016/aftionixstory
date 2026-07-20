/**
 * In-flight deduplication by conversationId + turnRequestId (Phase F).
 * No Redis — process-local only.
 */

type Entry = {
  promise: Promise<unknown>;
  createdAt: number;
};

const inflight = new Map<string, Entry>();

export function dedupeKey(params: {
  conversationId?: string;
  turnRequestId?: string;
  operation: string;
  promptId: string;
}): string | null {
  if (!params.turnRequestId) return null;
  return [
    params.conversationId || "_",
    params.turnRequestId,
    params.operation,
    params.promptId,
  ].join("::");
}

export async function withGenerationDedupe<T>(
  key: string | null,
  fn: () => Promise<T>
): Promise<{ result: T; deduplicated: boolean }> {
  if (!key) {
    return { result: await fn(), deduplicated: false };
  }

  const existing = inflight.get(key);
  if (existing) {
    const result = (await existing.promise) as T;
    return { result, deduplicated: true };
  }

  const promise = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, { promise, createdAt: Date.now() });
  const result = await promise;
  return { result, deduplicated: false };
}

export function __clearGenerationDedupeForTests(): void {
  inflight.clear();
}
