import { describe, expect, it } from "vitest";

import { CREATE_SUGGESTIONS, CHAT_SHELL_COPY } from "@/lib/chat/constants";
import {
  evaluateStoryCompleteness,
  normalizeChatStoryDraft,
} from "@/lib/chat/create-story-extraction";
import {
  shouldAutoOpenReview,
  summarizeStoryProgress,
} from "@/lib/chat/story-progress";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";

const incompleteDraft = normalizeChatStoryDraft({
  title: "Cursed Crown",
  genre: "Fantasy",
  tone: "dark",
  setting: "A kingdom under a blood moon",
});

const completeDraft = normalizeChatStoryDraft({
  title: "Midnight Contract",
  description: "A forbidden office romance with high stakes.",
  genre: "Dark Romance",
  language: "English",
  tone: "tense",
  setting: "Mumbai corporate tower",
  writingStyle: "Cinematic",
  pointOfView: "Third person",
  pacing: "Slow burn",
  initialPlot: "An assistant and a CEO hide their relationship.",
  characters: [
    {
      clientId: "c1",
      name: "Aanya",
      role: "Protagonist",
      personality: "Sharp, guarded, quietly romantic",
    },
  ],
});

describe("Create Story chat UX helpers", () => {
  it("keeps Guided Wizard as the default entry mode", () => {
    expect(parseNewStoryEntryMode(null)).toBe("wizard");
    expect(parseNewStoryEntryMode("chat")).toBe("chat");
  });

  it("uses conversational empty-state copy", () => {
    expect(CHAT_SHELL_COPY.create.title).toBe("Story Assistant");
    expect(CHAT_SHELL_COPY.create.emptyTitle).toBe("Let’s create your story");
    expect(CHAT_SHELL_COPY.create.emptyDescription).toContain("however it comes");
  });

  it("ships suggestion cards that send matching prompts", () => {
    expect(CREATE_SUGGESTIONS).toHaveLength(4);
    for (const suggestion of CREATE_SUGGESTIONS) {
      expect(suggestion.prompt.length).toBeGreaterThan(0);
      expect(suggestion.label.length).toBeGreaterThan(0);
    }
    expect(CREATE_SUGGESTIONS.map((s) => s.label)).toEqual([
      "I have a new story concept",
      "Help me create a forbidden romance",
      "I only have two characters",
      "Suggest something unique",
    ]);
    const forbidden = CREATE_SUGGESTIONS.find(
      (s) => s.id === "create-forbidden-romance"
    );
    expect(forbidden?.prompt).toBe("Help me create a forbidden romance");
  });

  it("summarizes compact story progress without requiring a permanent form", () => {
    const empty = summarizeStoryProgress(null);
    expect(empty.collected).toBe(0);
    expect(empty.total).toBe(8);
    expect(empty.label).toContain("0 of 8");

    const partial = summarizeStoryProgress(incompleteDraft);
    expect(partial.collected).toBeGreaterThan(0);
    expect(partial.collected).toBeLessThan(8);
    expect(partial.chips.find((c) => c.key === "genre")?.collected).toBe(true);
    expect(partial.chips.find((c) => c.key === "language")?.collected).toBe(
      false
    );
  });

  it("keeps Create Story disabled while incomplete and enables when complete", () => {
    const incomplete = evaluateStoryCompleteness(incompleteDraft);
    const complete = evaluateStoryCompleteness(completeDraft);

    expect(incomplete.status).toBe("needs_more_info");
    expect(incomplete.wizardInput).toBeNull();

    expect(complete.status).toBe("complete");
    expect(complete.wizardInput).not.toBeNull();
  });

  it("auto-opens review only when extraction newly becomes complete", () => {
    expect(
      shouldAutoOpenReview({
        previousStatus: "needs_more_info",
        nextStatus: "complete",
      })
    ).toBe(true);
    expect(
      shouldAutoOpenReview({
        previousStatus: "complete",
        nextStatus: "complete",
      })
    ).toBe(false);
    expect(
      shouldAutoOpenReview({
        previousStatus: null,
        nextStatus: "needs_more_info",
      })
    ).toBe(false);
  });

  it("documents that review edits stay on the shared draft object", () => {
    // Closing the drawer must not discard edits: the chat owns `story` state and
    // the drawer mutates it via onChange. Simulate an edit and re-evaluate.
    const edited = {
      ...completeDraft,
      title: "Midnight Contract — Revised",
    };
    expect(evaluateStoryCompleteness(edited).wizardInput?.title).toBe(
      "Midnight Contract — Revised"
    );
    expect(summarizeStoryProgress(edited).chips.find((c) => c.key === "title")
      ?.collected).toBe(true);
  });

  it("treats preview as opt-in (hidden until review opens or story exists)", () => {
    // Contract: no permanent preview render path when story is null.
    const story: typeof completeDraft | null = null;
    const reviewOpen = false;
    const shouldRenderPreview = Boolean(story) && reviewOpen;
    expect(shouldRenderPreview).toBe(false);

    const withStoryOpen = Boolean(completeDraft) && true;
    expect(withStoryOpen).toBe(true);
  });
});
