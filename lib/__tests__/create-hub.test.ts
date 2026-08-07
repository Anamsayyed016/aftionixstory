import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CREATE_CATEGORIES,
  STORY_STARTERS,
  canSubmitCreatePrompt,
  filterStoryStarters,
  sanitizeStarterPrompt,
} from "@/lib/create/story-starters";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";
import { parseNewStoryPageParams } from "@/lib/chat/new-story-page-params";

describe("Story starter data", () => {
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

describe("Chat home → routing contracts", () => {
  it("keeps Guided Wizard default when mode is absent", () => {
    expect(parseNewStoryEntryMode(null)).toBe("wizard");
    expect(parseNewStoryEntryMode("chat")).toBe("chat");
  });

  it("/create redirects to /home during Story Studio rebuild", () => {
    const source = readFileSync(
      path.resolve("app/(app)/create/page.tsx"),
      "utf8"
    );
    expect(source).toContain("redirect(");
    expect(source).toContain('"/home"');
  });

  it("/stories/new redirects to /home (wizard/chat UI offline)", () => {
    const source = readFileSync(
      path.resolve("app/(app)/stories/new/page.tsx"),
      "utf8"
    );
    expect(source).toContain("redirect(");
    expect(source).toContain('"/home"');
    expect(source).not.toContain("StoryWizard");
    expect(source).not.toContain("CreateStoryChat");
  });

  it("dashboard redirects to /home (chat UI offline)", () => {
    const source = readFileSync(
      path.resolve("app/(app)/dashboard/page.tsx"),
      "utf8"
    );
    expect(source).toContain("redirect(");
    expect(source).toContain('"/home"');
    expect(source).not.toContain("CreateStoryChat");
    expect(source).not.toContain("getDashboardStats");
  });

  it("sidebar/header/bottom nav only expose live hub surfaces", () => {
    const sidebar = readFileSync(
      path.resolve("components/app/app-sidebar.tsx"),
      "utf8"
    );
    const header = readFileSync(
      path.resolve("components/app/app-header.tsx"),
      "utf8"
    );
    const mobileNav = readFileSync(
      path.resolve("components/app/mobile-navigation.tsx"),
      "utf8"
    );
    for (const source of [sidebar, header, mobileNav]) {
      expect(source).not.toContain('href: "/create"');
      expect(source).not.toContain('href: "/stories"');
      expect(source).not.toContain('href: "/dashboard"');
      expect(source).not.toContain('href: "/admin"');
      expect(source).toContain('href: "/home"');
      expect(source).toContain('href: "/directory"');
      expect(source).toContain('href: "/connect"');
      expect(source).toContain('href: "/settings"');
    }
  });
});
