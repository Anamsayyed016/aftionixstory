import "server-only";

import { AIError } from "@/lib/ai/errors";
import { requireStoryOwnership } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db";
import { getAiEnv } from "@/lib/env";

import { createImageClient, generateImageB64, IMAGE_MODEL } from "./client";
import { normalizeImageAgentError } from "./errors";
import { buildStoryCoverPrompt } from "./prompt";
import { saveGeneratedImage } from "./storage";

function newRequestId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type GenerateStoryCoverResult = { imageUrl: string };

export async function generateStoryCover(
  storyId: string
): Promise<GenerateStoryCoverResult> {
  const { user, story } = await requireStoryOwnership(storyId);

  const env = getAiEnv();
  if (!env.OPENAI_API_KEY.trim()) {
    throw new AIError(
      "AI_NOT_CONFIGURED",
      "OPENAI_API_KEY is not configured.",
      false
    );
  }

  const prompt = buildStoryCoverPrompt(story);
  const requestId = newRequestId();
  const started = Date.now();

  try {
    const client = createImageClient(env.OPENAI_API_KEY);
    const b64 = await generateImageB64({ client, prompt, size: "1024x1536" });
    const buffer = Buffer.from(b64, "base64");
    const imageUrl = await saveGeneratedImage({
      buffer,
      kind: "cover",
      entityId: story.id,
    });

    await prisma.story.update({
      where: { id: story.id },
      data: { coverImageUrl: imageUrl },
    });

    await prisma.generationLog.create({
      data: {
        userId: user.id,
        storyId: story.id,
        provider: "openai",
        model: IMAGE_MODEL,
        action: "GENERATE_COVER",
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
          userId: user.id,
          storyId: story.id,
          provider: "openai",
          model: IMAGE_MODEL,
          action: "GENERATE_COVER",
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
