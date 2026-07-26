import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireStoryOwnership,
  storyUpdate,
  generationLogCreate,
  generateImageB64,
  saveGeneratedImage,
} = vi.hoisted(() => ({
  requireStoryOwnership: vi.fn(),
  storyUpdate: vi.fn(),
  generationLogCreate: vi.fn(),
  generateImageB64: vi.fn(),
  saveGeneratedImage: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireStoryOwnership,
  AuthzError: class AuthzError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    story: { update: storyUpdate },
    generationLog: { create: generationLogCreate },
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

import { generateStoryCover } from "@/lib/image-agent/generate-cover";

const baseStory = {
  id: "story_1",
  title: "The Glass Kingdom",
  genre: "fantasy",
  tone: "dark and hopeful",
  setting: "A shattered empire.",
  currentSummary: "A queen reunites three realms.",
  description: null,
};

describe("generateStoryCover", () => {
  beforeEach(() => {
    requireStoryOwnership.mockResolvedValue({
      user: { id: "user_1" },
      story: baseStory,
    });
    generateImageB64.mockResolvedValue(Buffer.from("fake-image-bytes").toString("base64"));
    saveGeneratedImage.mockResolvedValue("/uploads/images/cover-story_1-123.png");
    storyUpdate.mockResolvedValue({});
    generationLogCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("generates a cover, saves the file, and persists the URL", async () => {
    const result = await generateStoryCover("story_1");

    expect(result.imageUrl).toBe("/uploads/images/cover-story_1-123.png");
    expect(saveGeneratedImage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "cover", entityId: "story_1" })
    );
    expect(storyUpdate).toHaveBeenCalledWith({
      where: { id: "story_1" },
      data: { coverImageUrl: "/uploads/images/cover-story_1-123.png" },
    });

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.action).toBe("GENERATE_COVER");
    expect(logCall.success).toBe(true);
    expect(logCall.storyId).toBe("story_1");
    expect(logCall.characterId).toBeUndefined();
  });

  it("normalizes content-policy rejections and never leaks the raw provider message", async () => {
    const blockedError = Object.assign(
      new Error("Your request was rejected as a result of our safety system."),
      { status: 400 }
    );
    generateImageB64.mockRejectedValue(blockedError);

    await expect(generateStoryCover("story_1")).rejects.toMatchObject({
      code: "AI_CONTENT_BLOCKED",
    });

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.success).toBe(false);
    expect(logCall.errorCode).toBe("AI_CONTENT_BLOCKED");
    expect(storyUpdate).not.toHaveBeenCalled();
  });
});
