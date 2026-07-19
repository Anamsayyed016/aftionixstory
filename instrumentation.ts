/**
 * Next.js instrumentation — runs once when the Node server starts.
 * Logs AI configuration without exposing secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const buildId =
    process.env.STORYVERSE_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "local-dev";

  console.info(
    JSON.stringify({
      event: "storyverse.boot",
      buildId,
      chatFlow: "story_agent",
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const { logAiConfigurationAtStartup } = await import("@/lib/ai/health");
    logAiConfigurationAtStartup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      JSON.stringify({
        event: "ai.configuration",
        level: "warn",
        message: "AI startup configuration log skipped",
        error: message.slice(0, 200),
        timestamp: new Date().toISOString(),
      })
    );
  }
}
