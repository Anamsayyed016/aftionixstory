import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatConversationWhenUtc } from "@/lib/chat/format-conversation-when";
import { parseNewStoryPageParams } from "@/lib/chat/new-story-page-params";
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

  it("page passes server-parsed props into NewStoryEntry", () => {
    const page = readFileSync(
      path.resolve("app/(app)/stories/new/page.tsx"),
      "utf8"
    );
    expect(page).toContain("parseNewStoryPageParams");
    expect(page).toContain("initialMode={mode}");
    expect(page).toContain("initialPrompt={prompt}");
    expect(page).not.toContain("useSearchParams");
    expect(page).not.toContain("Suspense");
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

  it("history item does not use locale-default Intl during render", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/conversation-history-item.tsx"),
      "utf8"
    );
    expect(source).toContain("formatConversationWhenUtc");
    expect(source).not.toMatch(/Intl\.DateTimeFormat\(undefined/);
    expect(source).not.toContain("suppressHydrationWarning");
  });
});

describe("Hydration-safe markup / IDs", () => {
  it("history item does not nest buttons", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/conversation-history-item.tsx"),
      "utf8"
    );
    expect(source).toContain('role="button"');
    expect(source).toMatch(/type="button"[\s\S]*Archive/);
    expect(source).not.toMatch(/<button[\s\S]*<button/);
  });

  it("wizard initial state uses deterministic clientIds (no Math.random)", () => {
    const wizardSrc = readFileSync(
      path.resolve("components/app/story-wizard.tsx"),
      "utf8"
    );
    expect(wizardSrc).not.toMatch(/Math\.random/);
    expect(wizardSrc).toContain('uid("char", index)');
    expect(wizardSrc).toContain('uid("rule", index)');
    expect(wizardSrc).toContain("emptyCharacter(0)");
  });

  it("create-story-chat restores after mount (stable empty first paint)", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/create-story-chat.tsx"),
      "utf8"
    );
    expect(source).toMatch(/useState\(true\)/);
    expect(source).toMatch(
      /const \[messages, setMessages\] = useState<ChatMessage\[\]>\(\[\]\)/
    );
    expect(source).toContain("setRestoring(true)");
  });

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
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).toContain(
      "story ideas"
    );
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story ideas"
    );
    expect(MEMORY_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story ideas"
    );
  });
});
