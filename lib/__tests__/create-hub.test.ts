import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CREATE_CATEGORIES,
  STORY_STARTERS,
  buildStoryAssistantHref,
  canSubmitCreatePrompt,
  filterStoryStarters,
  sanitizeStarterPrompt,
} from "@/lib/create/story-starters";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";
import { parseNewStoryPageParams } from "@/lib/chat/new-story-page-params";

describe("Create hub starters", () => {
  it("defaults category list with All first", () => {
    expect(CREATE_CATEGORIES[0]).toBe("All");
  });

  it("filters starters by category and keeps All-tagged cards", () => {
    const romance = filterStoryStarters(STORY_STARTERS, "Romance");
    expect(romance.every((s) => s.category === "Romance" || s.category === "All")).toBe(
      true
    );
    expect(romance.some((s) => s.id === "slow-burn")).toBe(true);
    expect(romance.some((s) => s.id === "rough-idea")).toBe(true);

    const all = filterStoryStarters(STORY_STARTERS, "All");
    expect(all).toHaveLength(STORY_STARTERS.length);
  });

  it("builds a chat href with encoded prompt and mode=chat", () => {
    const href = buildStoryAssistantHref(
      "Help me create a slow-burn romance"
    );
    expect(href.startsWith("/stories/new?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("mode")).toBe("chat");
    expect(params.get("prompt")).toBe(
      "Help me create a slow-burn romance"
    );
  });

  it("blocks empty prompt submit and accepts non-empty", () => {
    expect(canSubmitCreatePrompt("")).toBe(false);
    expect(canSubmitCreatePrompt("   ")).toBe(false);
    expect(canSubmitCreatePrompt("A new story idea")).toBe(true);
  });

  it("sanitizes and length-limits starter prompts", () => {
    expect(sanitizeStarterPrompt("  hello  ")).toBe("hello");
    expect(sanitizeStarterPrompt("a".repeat(5000)).length).toBeLessThanOrEqual(
      2000
    );
    expect(sanitizeStarterPrompt("%F0%9F%8C%9F idea")).toContain("idea");
  });

  it("server page params are the sole prefill source (no sticky remount cache)", () => {
    expect(
      parseNewStoryPageParams({
        mode: "chat",
        prompt: "Prefill only",
      }).prompt
    ).toBe("Prefill only");
    expect(parseNewStoryPageParams({ mode: "chat" }).prompt).toBe("");
  });
});

describe("Create → Story Assistant integration contracts", () => {
  it("keeps Guided Wizard default when mode is absent", () => {
    expect(parseNewStoryEntryMode(null)).toBe("wizard");
    expect(parseNewStoryEntryMode("chat")).toBe("chat");
  });

  it("CreateStoryChat accepts initialComposerValue without auto-send wiring", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/create-story-chat.tsx"),
      "utf8"
    );
    expect(source).toContain("initialComposerValue");
    expect(source).toContain(
      'useState(() => initialComposerValue?.trim() ?? "")'
    );
    expect(source).not.toMatch(
      /initialComposerValue[\s\S]{0,200}sendPrompt\(/
    );
  });

  it("NewStoryEntry uses server props and strips prompt without soft navigation", () => {
    const source = readFileSync(
      path.resolve("components/app/new-story-entry.tsx"),
      "utf8"
    );
    expect(source).toContain("initialMode");
    expect(source).toContain("initialPrompt");
    expect(source).toContain("history.replaceState");
    expect(source).not.toMatch(/\brouter\.replace\b/);
    expect(source).not.toContain("useSearchParams");
    expect(source).not.toContain("captureStarterPrompt");
    expect(source).toContain("stripPromptQueryFromUrl");
    expect(source).toContain("initialComposerValue");
    expect(source).toContain("StoryWizard");
  });

  it("reuses existing app sidebar and does not add media generation", () => {
    const hub = readFileSync(
      path.resolve("components/app/create/create-hub.tsx"),
      "utf8"
    );
    const page = readFileSync(
      path.resolve("app/(app)/create/page.tsx"),
      "utf8"
    );
    const sidebar = readFileSync(
      path.resolve("components/app/app-sidebar.tsx"),
      "utf8"
    );

    expect(sidebar).toContain('href: "/create"');
    expect(sidebar).toContain('label: "Create"');
    expect(page).toContain("CreateHub");
    expect(hub).not.toMatch(/text to (image|video)/i);
    expect(hub).not.toMatch(/aspect ratio|camera controls/i);
    expect(hub).toMatch(/Character visuals and story videos/);
    expect(hub).not.toMatch(/openai|gemini|getAIProvider/i);
  });
});
