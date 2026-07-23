import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  mapStoryAgentTurnError,
  runStoryAgentTurn,
  storyAgentTurnInputSchema,
  type StoryAgentTurnActionData,
} from "@/lib/story-agent/run-turn";

export const dynamic = "force-dynamic";

/** Chunked pseudo-streaming: full reply is generated first, then drip-fed. */
const MAX_TOKEN_FRAMES = 120;
const FRAME_DELAY_MS = 20;

function chunkReplyIntoFrames(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? (text ? [text] : []);
  if (words.length === 0) return [];
  const perFrame = Math.max(1, Math.ceil(words.length / MAX_TOKEN_FRAMES));
  const frames: string[] = [];
  for (let i = 0; i < words.length; i += perFrame) {
    frames.push(words.slice(i, i + perFrame).join(""));
  }
  return frames;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusForErrorCode(code: string): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "GENERATION_LIMIT_REACHED":
    case "AI_RATE_LIMITED":
    case "PROVIDER_RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in." } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body." },
      },
      { status: 400 }
    );
  }

  const parsed = storyAgentTurnInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Please enter a valid message." },
      },
      { status: 400 }
    );
  }

  let result: StoryAgentTurnActionData;
  try {
    result = await runStoryAgentTurn({ userId, ...parsed.data });
  } catch (error) {
    const mapped = mapStoryAgentTurnError(error);
    if (mapped.success) {
      // mapStoryAgentTurnError always produces a failure result; unreachable.
      return NextResponse.json(mapped, { status: 500 });
    }
    return NextResponse.json(mapped, {
      status: statusForErrorCode(mapped.error.code),
    });
  }

  const frames = chunkReplyIntoFrames(result.assistantReply);
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const frame of frames) {
          if (cancelled) break;
          controller.enqueue(encoder.encode(sseFrame({ type: "token", text: frame })));
          await sleep(FRAME_DELAY_MS);
        }
        if (!cancelled) {
          controller.enqueue(
            encoder.encode(sseFrame({ type: "done", payload: result }))
          );
        }
      } catch {
        // Client disconnected mid-stream — the turn is already persisted.
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
