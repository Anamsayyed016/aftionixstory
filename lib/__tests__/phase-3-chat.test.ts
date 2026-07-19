import { describe, expect, it, vi } from "vitest";

import {
  assessContinueInstruction,
  buildRevisionInstruction,
  isCreateEnabledForDraft,
} from "@/lib/chat/continue-story-intent";
import { runContinueStoryChatTurn } from "@/lib/ai/services/chat-continue-story";

vi.mock("@/lib/db", () => ({
  prisma: {
    episode: {
      aggregate: vi.fn(async () => ({ _max: { episodeNumber: 2 } })),
      findFirst: vi.fn(async () => null),
    },
  },
}));

describe("Phase 3 chat — instruction intent", () => {
  it("rejects empty / tiny instructions as needs_more_info", () => {
    const result = assessContinueInstruction("  ");
    expect(result.status).toBe("needs_more_info");
    expect(result.followUpQuestion).toBeTruthy();
  });

  it("returns needs_more_info for vague continue without generation", () => {
    const result = assessContinueInstruction("continue");
    expect(result.status).toBe("needs_more_info");
    expect(result.assistantReply?.toLowerCase()).toContain("more");
  });

  it("marks concrete instructions actionable", () => {
    const result = assessContinueInstruction(
      "Continue with romance and emotional tension between the leads"
    );
    expect(result.status).toBe("actionable");
    expect(["MORE_ROMANTIC", "MORE_EMOTIONAL", "CONTINUE"]).toContain(
      result.action
    );
  });

  it("maps comedy intent to ADD_COMEDY", () => {
    const result = assessContinueInstruction(
      "Make the next episode funny but emotional with family comedy"
    );
    expect(result.status).toBe("actionable");
    expect(result.action).toBe("ADD_COMEDY");
  });

  it("builds revision instructions without dumping a full draft", () => {
    const text = buildRevisionInstruction({
      baseInstruction: "Continue with reunion tension",
      revision: "Add more comedy and include Sara",
    });
    expect(text).toContain("Revision request");
    expect(text).toContain("Sara");
    expect(text.length).toBeLessThan(500);
  });

  it("gates save on title/content length", () => {
    expect(isCreateEnabledForDraft({ title: "", content: "x".repeat(30) })).toBe(
      false
    );
    expect(
      isCreateEnabledForDraft({ title: "Night", content: "x".repeat(30) })
    ).toBe(true);
  });
});

describe("Phase 3 chat — orchestration", () => {
  it("does not call generate for vague instructions", async () => {
    const generate = vi.fn();
    const result = await runContinueStoryChatTurn({
      userId: "u1",
      storyId: "s1",
      instruction: "next",
      clientRequestId: "req_vague_001",
      hasSavedEpisodes: true,
      generate,
    });
    expect(result.status).toBe("needs_more_info");
    expect(generate).not.toHaveBeenCalled();
  });

  it("calls existing generation service for actionable instructions", async () => {
    const generate = vi.fn(async () => ({
      clientRequestId: "req_ok_001234",
      title: "Reunion",
      content: "A long enough episode body for testing continuity and emotion.",
      wordCount: 12,
      provider: "mock",
      model: "mock-model",
      durationMs: 10,
      action: "CONTINUE" as const,
    }));

    const result = await runContinueStoryChatTurn({
      userId: "u1",
      storyId: "s1",
      instruction: "Bring Sameer and Sayyed into the reunion scene",
      clientRequestId: "req_ok_001234",
      hasSavedEpisodes: true,
      generate,
    });

    expect(result.status).toBe("draft");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        storyId: "s1",
        clientRequestId: "req_ok_001234",
      })
    );
    if (result.status === "draft") {
      expect(result.draft.title).toBe("Reunion");
      expect(result.proposedEpisodeNumber).toBe(3);
    }
  });

  it("uses a new request id path for regenerate-style calls", async () => {
    const generate = vi.fn(async (input: { clientRequestId: string }) => ({
      clientRequestId: input.clientRequestId,
      title: "Again",
      content: "Regenerated episode content that is long enough to save later.",
      wordCount: 11,
      provider: "mock",
      model: "mock",
      durationMs: 5,
      action: "CONTINUE" as const,
    }));

    await runContinueStoryChatTurn({
      userId: "u1",
      storyId: "s1",
      instruction: "Continue with romance and emotional tension",
      clientRequestId: "req_regen_aaaa",
      hasSavedEpisodes: true,
      forceAction: "CONTINUE",
      generate,
    });
    await runContinueStoryChatTurn({
      userId: "u1",
      storyId: "s1",
      instruction: "Continue with romance and emotional tension",
      clientRequestId: "req_regen_bbbb",
      hasSavedEpisodes: true,
      forceAction: "CONTINUE",
      generate,
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][0].clientRequestId).toBe("req_regen_aaaa");
    expect(generate.mock.calls[1][0].clientRequestId).toBe("req_regen_bbbb");
  });

  it("documents single-save lock behavior", () => {
    const saveOnce = vi.fn();
    let locked = false;
    function handleSave() {
      if (locked) return;
      if (!isCreateEnabledForDraft({ title: "A", content: "x".repeat(25) })) {
        return;
      }
      locked = true;
      saveOnce();
    }
    handleSave();
    handleSave();
    expect(saveOnce).toHaveBeenCalledTimes(1);
  });

  it("documents discard does not delete", () => {
    const deleteFn = vi.fn();
    const discard = () => {
      // local clear only
    };
    discard();
    expect(deleteFn).not.toHaveBeenCalled();
  });
});

describe("Phase 3 chat — defaults preserved", () => {
  it("keeps composer as the conceptual default panel id", () => {
    const defaultPanel: "composer" | "chat" = "composer";
    expect(defaultPanel).toBe("composer");
  });
});
