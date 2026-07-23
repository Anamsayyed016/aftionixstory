import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { matchDeterministicIntent } from "@/lib/conversation-brain/intent-rules";
import { buildIntentContext } from "@/lib/conversation-brain/intent-context";
import { storyIntentToOperation } from "@/lib/conversation-brain/intents";
import { routeIntent } from "@/lib/story-agent/intent-router";
import {
  friendlyMessageForCode,
  StoryAgentError,
  userFacingStoryAgentMessage,
} from "@/lib/story-agent/errors";
import { isShortLanguagePreferenceReply } from "@/lib/story-agent/language-preferences";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { tryDeterministicTurn } from "@/lib/story-agent/deterministic-router";
import { isStoryContinuationModifier } from "@/lib/story-agent/canonical-story-context";

describe("short language preference replies (hinglish clarifying answer)", () => {
  it('classifies bare "hinglish" as a language preference, not write_scene', () => {
    expect(isShortLanguagePreferenceReply("hinglish")).toBe(true);
    expect(isShortLanguagePreferenceReply("Hinglish please")).toBe(true);
    expect(isShortLanguagePreferenceReply("write a scene in hinglish")).toBe(
      false
    );

    const legacy = routeIntent("hinglish", emptyStoryMemory());
    expect(legacy.operation).toBe("memory_update");
    expect(legacy.reason).toBe("language_preference_only");
    expect(legacy.fixedReply).toMatch(/hinglish|writing/i);
    expect(legacy.fixedReply).not.toMatch(/Previous draft kept/i);

    const ctx = buildIntentContext({
      memory: emptyStoryMemory(),
      storyId: null,
      userMessage: "hinglish",
    });
    const match = matchDeterministicIntent("hinglish", ctx);
    expect(match?.intent).toBe("language_change");
    expect(storyIntentToOperation("language_change")).toBe("memory_update");
  });

  it("deterministic turn acknowledges hinglish and patches preferences", () => {
    const det = tryDeterministicTurn("hinglish", emptyStoryMemory());
    expect(det.handled).toBe(true);
    expect(det.intent).toBe("update_preference");
    expect(det.operation).toBe("memory_update");
    expect(det.assistantReply.toLowerCase()).toMatch(/hinglish|writing/);
    expect(det.memoryPatch?.preferences?.dialogueLanguage).toMatch(/hinglish/i);
    expect(det.assistantReply).not.toContain(
      "Generated scene did not match the requested characters or conflict"
    );
  });

  it("never surfaces raw CONTEXT_MISMATCH validator strings to the user", () => {
    const raw = new StoryAgentError(
      "CONTEXT_MISMATCH",
      "Generated scene did not match the requested characters or conflict. Previous draft kept.",
      { retryable: true, operation: "write_scene" }
    );
    const facing = userFacingStoryAgentMessage(raw, "write_scene");
    expect(facing).toBe(friendlyMessageForCode("CONTEXT_MISMATCH", "write_scene"));
    expect(facing).not.toContain("Previous draft kept");
    expect(facing).not.toContain(
      "Generated scene did not match the requested characters or conflict"
    );
  });

  it("treats hinglish as a continuation modifier for canon locks, but preference-only gate still applies", () => {
    // Canon inheritance may still treat hinglish as a modifier.
    expect(isStoryContinuationModifier("hinglish")).toBe(true);
    // Auto-generation gate must still see it as preference-only.
    expect(isShortLanguagePreferenceReply("hinglish")).toBe(true);
  });
});

describe("action-router user-facing errors", () => {
  it("action-router maps StoryAgentError via friendlyMessageForCode (no raw leak)", () => {
    const source = readFileSync(
      path.resolve("lib/story-agent/action-router.ts"),
      "utf8"
    );
    expect(source).toContain("friendlyMessageForCode");
    expect(source).toContain("isStoryAgentError");
    expect(source).not.toMatch(
      /catch\s*\(error\)\s*\{[^}]*error\.message/s
    );
  });

  it("brain skips auto Episode 1 after preference-only replies", () => {
    const source = readFileSync(
      path.resolve("lib/conversation-brain/brain.ts"),
      "utf8"
    );
    expect(source).toContain("isShortLanguagePreferenceReply");
    expect(source).toContain("preferenceOnlyReply");
    expect(source).toContain("!preferenceOnlyReply");
  });
});
