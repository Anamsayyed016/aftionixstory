import { describe, expect, it } from "vitest";

import { assessHinglishQuality } from "@/lib/ai/quality/hinglish-quality";
import {
  assessOutputIntegrity,
  mergePartialCreative,
} from "@/lib/ai/quality/output-integrity";
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import {
  detectStyleFeedback,
  maybeDecorateChatReply,
  readStyleProfile,
} from "@/lib/story-agent/style-profile";
import { getAIProvider, setAIProviderOverride } from "@/lib/ai/registry";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { __resetEnvCacheForTests } from "@/lib/env";

describe("Greeting reliability", () => {
  it("routes hey/hi with fixed reply and no LLM required", () => {
    for (const msg of ["hey", "hi", "hello", "kaise ho"]) {
      const route = routeIntent(msg);
      expect(route.skipClassifier).toBe(true);
      expect(route.fixedReply).toBeTruthy();
      expect(route.operation).toBe("conversational_chat");
      expect(route.fixedReply!.toLowerCase()).not.toContain("something went wrong");
    }
  });
});

describe("Style feedback learning", () => {
  it("maps shuddh feedback to casual + avoidFormalHindi", () => {
    const current = readStyleProfile({});
    const detected = detectStyleFeedback(
      "bahut shuddh hai, simple human type karo",
      current
    );
    expect(detected.matched).toBe(true);
    expect(detected.patch.formality).toBe("casual");
    expect(detected.patch.avoidFormalHindi).toBe(true);
  });

  it("updates emoji preference", () => {
    const detected = detectStyleFeedback(
      "emoji bhi use karo",
      readStyleProfile({ emojiStyle: "none" })
    );
    expect(detected.patch.emojiStyle).toBe("light");
  });

  it("decorates chat replies lightly", () => {
    const withEmoji = maybeDecorateChatReply("Nice concept.", "light");
    expect(withEmoji).toMatch(/Nice concept/);
    expect(maybeDecorateChatReply("Nice ✨", "light")).toBe("Nice ✨");
  });
});

describe("Output integrity", () => {
  it("flags finish_reason length as truncated", () => {
    const result = assessOutputIntegrity({
      text: "Azar walked into the room and said hel",
      finishReason: "length",
    });
    expect(result.truncated).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("merges partial + continuation without naive duplication", () => {
    const merged = mergePartialCreative(
      "Once upon a time in Mumbai.",
      "in Mumbai. The rain started."
    );
    expect(merged).toContain("Once upon a time");
    expect(merged).toContain("The rain started");
  });
});

describe("Hinglish quality signals", () => {
  it("flags overly formal Hindi markers", () => {
    const q = assessHinglishQuality(
      "Uske hriday mein atyadhik samvedana thi aur woh vyakul tha."
    );
    expect(q.ok).toBe(false);
  });
});

describe("Style revise routing", () => {
  it("revises draft when shuddh feedback and draft exist", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "x",
      content: "A complete English draft body for revision testing purposes.",
      wordCount: 10,
    };
    const route = routeIntent("bahut shuddh hai, simple human type karo", memory);
    expect(route.operation).toBe("revise_draft");
  });
});

describe("Provider registry (no local runtime)", () => {
  it("uses mock only via explicit override for tests", () => {
    __resetEnvCacheForTests();
    setAIProviderOverride(new MockAIProvider());
    expect(getAIProvider().name).toBe("mock");
    setAIProviderOverride(null);
    __resetEnvCacheForTests();
  });
});
