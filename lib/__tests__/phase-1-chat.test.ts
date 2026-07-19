import { describe, expect, it } from "vitest";

import {
  CHAT_MAX_CHARS,
  CONTINUE_SUGGESTIONS,
  CREATE_SUGGESTIONS,
  DEMO_ASSISTANT_REPLIES,
} from "@/lib/chat/constants";
import {
  canSendMessage,
  getDemoAssistantReply,
  parseNewStoryEntryMode,
  shouldSendOnKeyDown,
} from "@/lib/chat/utils";

describe("Phase 1 chat — entry mode parsing", () => {
  it("defaults to wizard when mode is missing or invalid", () => {
    expect(parseNewStoryEntryMode(null)).toBe("wizard");
    expect(parseNewStoryEntryMode(undefined)).toBe("wizard");
    expect(parseNewStoryEntryMode("")).toBe("wizard");
    expect(parseNewStoryEntryMode("wizard")).toBe("wizard");
    expect(parseNewStoryEntryMode("nope")).toBe("wizard");
  });

  it("opens chat when mode=chat", () => {
    expect(parseNewStoryEntryMode("chat")).toBe("chat");
  });
});

describe("Phase 1 chat — composer send rules", () => {
  it("blocks empty or whitespace-only messages", () => {
    expect(canSendMessage("", false)).toBe(false);
    expect(canSendMessage("   ", false)).toBe(false);
  });

  it("allows a non-empty message when not busy", () => {
    expect(canSendMessage("A forbidden romance", false)).toBe(true);
  });

  it("blocks sends while busy", () => {
    expect(canSendMessage("Hello", true)).toBe(false);
  });

  it("blocks messages over the client max", () => {
    expect(canSendMessage("x".repeat(CHAT_MAX_CHARS + 1), false)).toBe(false);
    expect(canSendMessage("x".repeat(CHAT_MAX_CHARS), false)).toBe(true);
  });

  it("Enter sends and Shift+Enter does not", () => {
    expect(shouldSendOnKeyDown({ key: "Enter", shiftKey: false })).toBe(true);
    expect(shouldSendOnKeyDown({ key: "Enter", shiftKey: true })).toBe(false);
    expect(shouldSendOnKeyDown({ key: "a", shiftKey: false })).toBe(false);
  });
});

describe("Phase 1 chat — demo replies and suggestions", () => {
  it("returns the correct placeholder reply per mode", () => {
    expect(getDemoAssistantReply("create")).toBe(DEMO_ASSISTANT_REPLIES.create);
    expect(getDemoAssistantReply("continue")).toBe(
      DEMO_ASSISTANT_REPLIES.continue
    );
  });

  it("keeps suggestion prompts aligned with labels for create", () => {
    for (const suggestion of CREATE_SUGGESTIONS) {
      expect(suggestion.prompt.length).toBeGreaterThan(0);
      expect(suggestion.label.length).toBeGreaterThan(0);
    }
    expect(CREATE_SUGGESTIONS).toHaveLength(4);
  });

  it("keeps suggestion prompts aligned with labels for continue", () => {
    for (const suggestion of CONTINUE_SUGGESTIONS) {
      expect(suggestion.prompt).toBe(suggestion.label);
    }
    expect(CONTINUE_SUGGESTIONS).toHaveLength(4);
  });
});
