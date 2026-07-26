import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generationLogCreate, generateImageB64, saveGeneratedImage } = vi.hoisted(
  () => ({
    generationLogCreate: vi.fn(),
    generateImageB64: vi.fn(),
    saveGeneratedImage: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({
  prisma: {
    generationLog: { create: generationLogCreate },
  },
}));

vi.mock("@/lib/auth/authorization", () => ({
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/env", () => ({
  getAiEnv: () => ({ OPENAI_API_KEY: "sk-test-key" }),
}));

vi.mock("@/lib/image-agent/client", () => ({
  createImageClient: vi.fn(() => ({})),
  generateImageB64,
  IMAGE_MODEL: "gpt-image-1",
}));

vi.mock("@/lib/image-agent/storage", () => ({
  saveGeneratedImage,
}));

import { generateFreeformChatImage } from "@/lib/image-agent/generate-freeform";

describe("generateFreeformChatImage", () => {
  beforeEach(() => {
    generateImageB64.mockResolvedValue(Buffer.from("fake-image-bytes").toString("base64"));
    saveGeneratedImage.mockResolvedValue("/uploads/images/chat-conv_1-123.png");
    generationLogCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("generates from the raw prompt, saves the file, and logs with a nullable storyId", async () => {
    const result = await generateFreeformChatImage({
      userId: "user_1",
      conversationId: "conv_1",
      storyId: null,
      prompt: "a lighthouse in a storm",
    });

    expect(result.imageUrl).toBe("/uploads/images/chat-conv_1-123.png");
    expect(generateImageB64).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "a lighthouse in a storm" })
    );
    expect(saveGeneratedImage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "chat", entityId: "conv_1" })
    );

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.action).toBe("GENERATE_CHAT_IMAGE");
    expect(logCall.success).toBe(true);
    expect(logCall.storyId).toBeNull();
  });

  it("logs with the linked storyId when the conversation belongs to a story", async () => {
    await generateFreeformChatImage({
      userId: "user_1",
      conversationId: "conv_2",
      storyId: "story_9",
      prompt: "a castle at dusk",
    });

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.storyId).toBe("story_9");
  });

  it("normalizes provider errors, logs the failure, and never leaks the raw message", async () => {
    const rateLimitError = Object.assign(new Error("rate limit exceeded"), {
      status: 429,
    });
    generateImageB64.mockRejectedValue(rateLimitError);

    await expect(
      generateFreeformChatImage({
        userId: "user_1",
        conversationId: "conv_1",
        storyId: null,
        prompt: "a lighthouse in a storm",
      })
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED" });

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.success).toBe(false);
    expect(logCall.errorCode).toBe("AI_RATE_LIMITED");
  });
});
