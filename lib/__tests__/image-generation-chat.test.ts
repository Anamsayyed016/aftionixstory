import { describe, expect, it } from "vitest";

import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import { classifyUniversalIntentDeterministic } from "@/lib/universal-router";
import {
  extractImagePromptSubject,
  isVagueImagePrompt,
} from "@/lib/image-agent/freeform-prompt";

const awaitingImagePrompt = {
  ...DEFAULT_CONVERSATION_FLOW,
  phase: "shaping" as const,
  awaiting: { type: "clarification" as const, topic: "image_prompt" as const },
  lastIntent: "awaiting_image_prompt",
};

describe("universal intent router — image generation", () => {
  it("classifies a direct image request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "generate an image of a red dragon over a castle",
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("image_generation_request");
    expect(hit!.matchedSignals).toContain("image_generation_request");
  });

  it("classifies varied phrasing (create a picture, draw, make an avatar)", () => {
    for (const msg of [
      "create a picture of a sunset over mountains",
      "draw a cat wearing a wizard hat",
      "can you make an avatar for my character",
    ]) {
      const hit = classifyUniversalIntentDeterministic({ userMessage: msg });
      expect(hit?.intent).toBe("image_generation_request");
    }
  });

  it("does not steal story-writing requests that happen to say 'create'", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "help me create a forbidden romance story",
    });
    expect(hit?.intent).not.toBe("image_generation_request");
  });

  it("treats a reply while awaiting image_prompt as the image request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "a red sports car parked at sunset on a cliff road",
      conversationFlow: awaitingImagePrompt,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("image_generation_request");
    expect(hit!.reason).toBe("awaiting_image_prompt_answer");
  });

  it("still lets a clearly off-topic question override awaiting image_prompt", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "what is python",
      conversationFlow: awaitingImagePrompt,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("coding_help");
  });
});

describe("freeform image prompt vagueness", () => {
  it("flags bare trigger phrases with no subject as vague", () => {
    expect(isVagueImagePrompt("i want to generate an image")).toBe(true);
    expect(isVagueImagePrompt("generate an image")).toBe(true);
    expect(isVagueImagePrompt("can you make a picture")).toBe(true);
  });

  it("does not flag a prompt with real descriptive content", () => {
    expect(
      isVagueImagePrompt(
        "generate an image of a red dragon flying over a snowy castle at night"
      )
    ).toBe(false);
  });

  it("extracts the subject by stripping trigger and filler phrasing", () => {
    const subject = extractImagePromptSubject(
      "please generate an image of a lighthouse in a storm"
    );
    expect(subject.toLowerCase()).toContain("lighthouse");
    expect(subject.toLowerCase()).not.toContain("please");
    expect(subject.toLowerCase()).not.toContain("generate");
  });
});
