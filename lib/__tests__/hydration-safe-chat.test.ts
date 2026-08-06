import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatConversationWhenUtc } from "@/lib/chat/format-conversation-when";
import { parseNewStoryPageParams } from "@/lib/chat/new-story-page-params";
import {
  canSendMessage,
  isComposerInteractionLocked,
} from "@/lib/chat/utils";
import { routeIntent } from "@/lib/story-agent/intent-router";
import {
  BRAINSTORM_FAILURE_USER_MESSAGE,
  MEMORY_FAILURE_USER_MESSAGE,
  PROVIDER_FAILURE_USER_MESSAGE,
} from "@/lib/story-agent/concept-reply";

describe("Hydration-safe /stories/new params", () => {
  it("parses mode=chat without prompt to empty composer seed", () => {
    const parsed = parseNewStoryPageParams({ mode: "chat" });
    expect(parsed.mode).toBe("chat");
    expect(parsed.prompt).toBe("");
  });

  it("parses encoded prompt once and length-limits it", () => {
    const parsed = parseNewStoryPageParams({
      mode: "chat",
      prompt: "Help%20me%20create%20a%20slow-burn%20romance",
    });
    expect(parsed.mode).toBe("chat");
    expect(parsed.prompt).toBe("Help me create a slow-burn romance");
    expect(
      parseNewStoryPageParams({
        mode: "chat",
        prompt: "x".repeat(5000),
      }).prompt.length
    ).toBeLessThanOrEqual(2000);
  });

  it("defaults missing mode to wizard (Guided Wizard unchanged)", () => {
    expect(parseNewStoryPageParams({}).mode).toBe("wizard");
    expect(parseNewStoryPageParams(null).mode).toBe("wizard");
  });

  it("page shows rebuild placeholder (wizard/chat UI removed)", () => {
    const page = readFileSync(
      path.resolve("app/(app)/stories/new/page.tsx"),
      "utf8"
    );
    expect(page).toContain("StoryStudioRebuildPlaceholder");
    expect(page).not.toContain("StoryWizard");
    expect(page).not.toContain("useSearchParams");
    expect(page).not.toContain("Suspense");
  });
});

describe("Composer click lock (Send / suggestions)", () => {
  it("unlocks once conversationId exists even if restoring history", () => {
    expect(
      isComposerInteractionLocked({
        restoring: true,
        conversationId: "conv_1",
      })
    ).toBe(false);
  });

  it("locks only while restoring without a conversation id", () => {
    expect(
      isComposerInteractionLocked({
        restoring: true,
        conversationId: null,
      })
    ).toBe(true);
  });

  it("keeps Send enabled for a non-empty prefilled prompt when unlocked", () => {
    const locked = isComposerInteractionLocked({
      restoring: true,
      conversationId: "conv_1",
    });
    expect(locked).toBe(false);
    expect(
      canSendMessage(
        "I want to start a new story. Help me shape the concept.",
        locked
      )
    ).toBe(true);
  });
});

describe("Hydration-safe timestamps", () => {
  it("formats the same UTC label regardless of host timezone intent", () => {
    const iso = "2026-07-20T12:30:00.000Z";
    const a = formatConversationWhenUtc(iso);
    const b = formatConversationWhenUtc(iso);
    expect(a).toBe(b);
    expect(a).toMatch(/UTC$/);
    expect(a).toMatch(/Jul/);
    expect(a).toMatch(/20/);
  });
});

describe("Hydration-safe markup / IDs", () => {
  it("does not keep module-level sticky starter prompt", () => {
    const starters = readFileSync(
      path.resolve("lib/create/story-starters.ts"),
      "utf8"
    );
    expect(starters).not.toContain("stickyStarterPrompt");
    expect(starters).not.toContain("captureStarterPrompt");
  });
});

describe("Separate AI routing RCA (not hydration)", () => {
  it("character lead facts route to memory_update, not brainstorm", () => {
    const route = routeIntent("Azar male lead, Anaya female lead");
    expect(route.operation).toBe("memory_update");
    expect(route.reason).toBe("memory_facts");
    expect(route.fixedReply).toBeTruthy();
  });

  it("keeps brainstorm failure copy separate from chat/memory", () => {
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).toContain("ideas");
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story ideas"
    );
    expect(MEMORY_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story ideas"
    );
  });
});
