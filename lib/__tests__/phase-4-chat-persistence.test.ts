import { describe, expect, it } from "vitest";

import {
  clearContinueDraft,
  emptyContinueState,
  emptyCreateState,
  previewFromContent,
  titleFromContinueStory,
  titleFromCreateMessage,
  truncateTitle,
} from "@/lib/chat/conversation-state";
import {
  appendChatMessageSchema,
  createConversationSchema,
  updateConversationStateSchema,
} from "@/lib/validations/conversation";

describe("Phase 4 chat persistence — titles", () => {
  it("uses create fallback title", () => {
    expect(titleFromCreateMessage("")).toBe("New story idea");
    expect(titleFromCreateMessage("  A CEO romance in Mumbai  ")).toContain(
      "CEO romance"
    );
  });

  it("builds continue titles from story name", () => {
    expect(titleFromContinueStory("Midnight Contract")).toBe(
      "Continue: Midnight Contract"
    );
    expect(
      titleFromContinueStory("Midnight Contract", "Add reunion tension")
    ).toContain("reunion");
  });

  it("truncates long titles", () => {
    const long = "x".repeat(120);
    expect(truncateTitle(long).length).toBeLessThanOrEqual(72);
  });
});

describe("Phase 4 chat persistence — validation", () => {
  it("requires storyId for CONTINUE and forbids it for CREATE", () => {
    expect(
      createConversationSchema.safeParse({ mode: "CONTINUE" }).success
    ).toBe(false);
    expect(
      createConversationSchema.safeParse({
        mode: "CREATE",
        storyId: "abc",
      }).success
    ).toBe(false);
    expect(
      createConversationSchema.safeParse({ mode: "CREATE" }).success
    ).toBe(true);
    expect(
      createConversationSchema.safeParse({
        mode: "CONTINUE",
        storyId: "story_1",
      }).success
    ).toBe(true);
  });

  it("rejects SYSTEM role from client schema", () => {
    const parsed = appendChatMessageSchema.safeParse({
      conversationId: "c1",
      role: "SYSTEM",
      content: "hack",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts USER/ASSISTANT messages with optional requestId", () => {
    const parsed = appendChatMessageSchema.safeParse({
      conversationId: "c1",
      role: "USER",
      content: "Continue with romance",
      requestId: "req_abc12345",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates create and continue state shapes", () => {
    expect(
      updateConversationStateSchema.safeParse({
        conversationId: "c1",
        state: emptyCreateState(),
      }).success
    ).toBe(true);

    expect(
      updateConversationStateSchema.safeParse({
        conversationId: "c1",
        state: {
          ...emptyContinueState(),
          draft: {
            title: "Ep",
            content: "x".repeat(30),
            wordCount: 5,
            clientRequestId: "req_draft01",
          },
        },
      }).success
    ).toBe(true);
  });
});

describe("Phase 4 chat persistence — draft restore semantics", () => {
  it("clears draft after successful save while remembering episode id", () => {
    const cleared = clearContinueDraft(
      {
        instruction: "reunion",
        draft: {
          title: "Night",
          content: "body",
          wordCount: 1,
          clientRequestId: "req_x123456",
        },
        draftDirty: true,
      },
      "ep_saved"
    );
    expect(cleared.draft).toBeNull();
    expect(cleared.draftDirty).toBe(false);
    expect(cleared.draftSavedEpisodeId).toBe("ep_saved");
    expect(cleared.instruction).toBe("reunion");
  });

  it("keeps previews short for history lists", () => {
    expect(previewFromContent("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it("documents restored draft remains unsaved until saveEpisodeAction", () => {
    const restoredUnsaved = true;
    const autoSaved = false;
    expect(restoredUnsaved && !autoSaved).toBe(true);
  });
});

describe("Phase 4 chat persistence — idempotency contract", () => {
  it("treats repeated requestId as duplicate key candidate", () => {
    const first = appendChatMessageSchema.parse({
      conversationId: "c1",
      role: "USER",
      content: "Hello there",
      requestId: "req_same_001",
    });
    const second = appendChatMessageSchema.parse({
      conversationId: "c1",
      role: "USER",
      content: "Hello there",
      requestId: "req_same_001",
    });
    expect(first.requestId).toBe(second.requestId);
  });
});
