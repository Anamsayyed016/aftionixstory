import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CreateStoryChat layout regression", () => {
  it("keeps horizontal (row) flex so the chat section is not collapsed by the sidebar", () => {
    const source = readFileSync(
      path.resolve("components/app/chat/create-story-chat.tsx"),
      "utf8"
    );
    // The outer shell must be flex row (default). A mistaken flex-col makes
    // ChatSidebar's h-full consume the viewport and leave the main panel at 0 height.
    expect(source).toMatch(
      /flex h-full min-h-0 flex-1 overflow-hidden rounded-2xl/
    );
    expect(source).not.toMatch(
      /flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl/
    );
    expect(source).toContain("ChatErrorBoundary");
  });
});
