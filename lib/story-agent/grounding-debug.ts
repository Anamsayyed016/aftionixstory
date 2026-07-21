/**
 * Temporary structured logs for story grounding / repair (dev + explicit flag).
 */

export function isStoryGroundingDebugEnabled(): boolean {
  return process.env.STORYVERSE_DEBUG_CONTEXT === "true";
}

export function logStoryGrounding(event: string, payload: Record<string, unknown>) {
  if (!isStoryGroundingDebugEnabled()) return;
  console.info(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...payload,
    })
  );
}
