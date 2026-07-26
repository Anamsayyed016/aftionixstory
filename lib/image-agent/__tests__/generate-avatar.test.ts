import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCharacterOwnership,
  characterUpdate,
  generationLogCreate,
  generateImageB64,
  saveGeneratedImage,
} = vi.hoisted(() => ({
  requireCharacterOwnership: vi.fn(),
  characterUpdate: vi.fn(),
  generationLogCreate: vi.fn(),
  generateImageB64: vi.fn(),
  saveGeneratedImage: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireCharacterOwnership,
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
    character: { update: characterUpdate },
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

import { generateCharacterAvatar } from "@/lib/image-agent/generate-avatar";

const baseCharacter = {
  id: "char_1",
  storyId: "story_1",
  name: "Aria",
  age: 27,
  gender: "female",
  role: "protagonist",
  personality: "Fierce and witty.",
  appearance: "Silver hair.",
  background: "Northern wastes.",
  speakingStyle: "Sarcastic.",
};

describe("generateCharacterAvatar", () => {
  beforeEach(() => {
    requireCharacterOwnership.mockResolvedValue({
      user: { id: "user_1" },
      character: baseCharacter,
      story: { id: "story_1" },
    });
    generateImageB64.mockResolvedValue(Buffer.from("fake-image-bytes").toString("base64"));
    saveGeneratedImage.mockResolvedValue("/uploads/images/avatar-char_1-123.png");
    characterUpdate.mockResolvedValue({});
    generationLogCreate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("generates an avatar, saves the file, and persists the URL", async () => {
    const result = await generateCharacterAvatar("char_1");

    expect(result.imageUrl).toBe("/uploads/images/avatar-char_1-123.png");
    expect(generateImageB64).toHaveBeenCalledOnce();
    expect(saveGeneratedImage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "avatar", entityId: "char_1" })
    );
    expect(characterUpdate).toHaveBeenCalledWith({
      where: { id: "char_1" },
      data: { avatarUrl: "/uploads/images/avatar-char_1-123.png" },
    });

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.action).toBe("GENERATE_AVATAR");
    expect(logCall.success).toBe(true);
    expect(logCall.storyId).toBe("story_1");
    expect(logCall.characterId).toBe("char_1");
  });

  it("normalizes provider errors, logs the failure, and never leaks the raw message", async () => {
    const rateLimitError = Object.assign(new Error("You have hit the rate limit"), {
      status: 429,
      code: "rate_limit_exceeded",
    });
    generateImageB64.mockRejectedValue(rateLimitError);

    await expect(generateCharacterAvatar("char_1")).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
    });

    const logCall = generationLogCreate.mock.calls[0][0].data;
    expect(logCall.success).toBe(false);
    expect(logCall.errorCode).toBe("AI_RATE_LIMITED");
    expect(characterUpdate).not.toHaveBeenCalled();
  });
});
