import { describe, expect, it } from "vitest";

import {
  buildMessageWithAttachedImage,
  isBareImageShareMessage,
} from "@/lib/universal-router/attached-image";
import { classifyUniversalIntentDeterministic } from "@/lib/universal-router/classify";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";

describe("attached image message enrichment", () => {
  it("detects bare image-share labels", () => {
    expect(isBareImageShareMessage("Shared an image")).toBe(true);
    expect(isBareImageShareMessage("")).toBe(true);
    expect(isBareImageShareMessage("make her the heroine")).toBe(false);
  });

  it("forces acknowledgment instructions for bare shares", () => {
    const enriched = buildMessageWithAttachedImage({
      message: "Shared an image",
      imageUrl: "/api/media/upload-u-1.png",
    });
    expect(enriched).toContain("acknowledge");
    expect(enriched).toContain("/api/media/upload-u-1.png");
    expect(enriched).not.toBe("Shared an image");
  });

  it("routes bare image share to general_question even while awaiting a story slot", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "Shared an image",
      hasAttachedImage: true,
      conversationFlow: {
        ...DEFAULT_CONVERSATION_FLOW,
        awaiting: { type: "clarification", topic: "conflict" },
      },
    });
    expect(hit?.intent).toBe("general_question");
    expect(hit?.reason).toBe("attached_image_share");
  });
});
