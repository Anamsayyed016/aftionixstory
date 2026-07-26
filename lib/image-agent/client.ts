import "server-only";

import OpenAI from "openai";

import { AIError } from "@/lib/ai/errors";

export const IMAGE_MODEL = "gpt-image-1";

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

export type ImageClientLike = {
  images: {
    generate: (params: {
      model: string;
      prompt: string;
      size?: ImageSize;
      n?: number;
    }) => Promise<{ data?: Array<{ b64_json?: string }> }>;
  };
};

export function createImageClient(apiKey: string): ImageClientLike {
  return new OpenAI({ apiKey }) as unknown as ImageClientLike;
}

export async function generateImageB64(params: {
  client: ImageClientLike;
  prompt: string;
  size?: ImageSize;
}): Promise<string> {
  const result = await params.client.images.generate({
    model: IMAGE_MODEL,
    prompt: params.prompt,
    size: params.size ?? "1024x1024",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "The image provider returned no image data.",
      false
    );
  }
  return b64;
}
