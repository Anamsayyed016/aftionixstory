import { NextResponse } from "next/server";

/**
 * Lightweight deploy/health probe — no auth, no secrets.
 */
export async function GET() {
  const commit =
    process.env.STORYVERSE_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    "unknown";
  const builtAt = process.env.STORYVERSE_BUILT_AT || null;

  return NextResponse.json(
    {
      ok: true,
      service: "storyverse-ai",
      commit,
      builtAt,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      groundingDebug: process.env.STORYVERSE_DEBUG_CONTEXT === "true",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
