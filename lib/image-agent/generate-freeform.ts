import "server-only";

import { prisma } from "@/lib/db";
import { getAiEnv } from "@/lib/env";
import { AIError } from "@/lib/ai/errors";

import { createImageClient, generateImageB64, IMAGE_MODEL } from "./client";
import { normalizeImageAgentError } from "./errors";
import { saveGeneratedImage } from "./storage";

function newRequestId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type GenerateFreeformChatImageResult = { imageUrl: string };

/**
 * Freeform chat-triggered image generation — a raw prompt, not tied to a
 * Character or Story record. Caller (run-turn.ts) owns auth/turn context;
 * this only generates, stores, and logs.
 */
export async function generateFreeformChatImage(params: {
  userId: string;
  conversationId: string;
  storyId: string | null;
  prompt: string;
}): Promise<GenerateFreeformChatImageResult> {
  const env = getAiEnv();
  if (!env.OPENAI_API_KEY.trim()) {
    throw new AIError(
      "AI_NOT_CONFIGURED",
      "OPENAI_API_KEY is not configured.",
      false
    );
  }

  const requestId = newRequestId();
  const started = Date.now();

  try {
    const client = createImageClient(env.OPENAI_API_KEY);
    const b64 = await generateImageB64({ client, prompt: params.prompt });
    const buffer = Buffer.from(b64, "base64");
    const imageUrl = await saveGeneratedImage({
      buffer,
      kind: "chat",
      entityId: params.conversationId,
    });

    await prisma.generationLog.create({
      data: {
        userId: params.userId,
        storyId: params.storyId,
        provider: "openai",
        model: IMAGE_MODEL,
        action: "GENERATE_CHAT_IMAGE",
        durationMs: Date.now() - started,
        success: true,
        requestId,
      },
    });

    return { imageUrl };
  } catch (error) {
    const normalized = normalizeImageAgentError(error);
    try {
      await prisma.generationLog.create({
        data: {
          userId: params.userId,
          storyId: params.storyId,
          provider: "openai",
          model: IMAGE_MODEL,
          action: "GENERATE_CHAT_IMAGE",
          durationMs: Date.now() - started,
          success: false,
          errorCode: normalized.code,
          requestId,
        },
      });
    } catch {
      // Swallow log write failures after the primary error.
    }
    throw normalized;
  }
}
