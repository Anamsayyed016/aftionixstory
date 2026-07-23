/**
 * Universal Intent Router — Phase 1 top-level classification.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";
import {
  buildLanguageLayer,
  platformIdentity,
} from "@/lib/prompt-registry/layers";
import {
  classifyUniversalIntent,
  classifyUniversalIntentDeterministic,
  MIRROR_USER_LANGUAGE_FRAGMENT,
  mirrorUserLanguageStyle,
} from "@/lib/universal-router";

const awaitingConflict = {
  ...DEFAULT_CONVERSATION_FLOW,
  phase: "shaping" as const,
  awaiting: { type: "clarification" as const, topic: "conflict" as const },
  lastIntent: "awaiting_answer",
};

describe("universal intent router — deterministic", () => {
  it("(a) general question during story setup routes to General AI, not the slot", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "what is python",
      conversationFlow: awaitingConflict,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("coding_help");
    expect(hit!.matchedSignals).toContain("coding_help");
    expect(hit!.enableWebSearch).toBe(false);
  });

  it("(a2) off-topic explain question overrides awaiting conflict slot", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "What is photosynthesis?",
      conversationFlow: awaitingConflict,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("general_question");
    expect(hit!.reason).toMatch(/off_topic|question_over_slot|general/);
  });

  it("(b) genuine story-setup answer still routes to story_continuation", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "They fight over a family secret that could ruin the wedding",
      conversationFlow: awaitingConflict,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("story_continuation");
    expect(hit!.reason).toBe("awaiting_slot_answer");
  });

  it("(b2) short genre-like slot answer is accepted while awaiting", () => {
    const awaitingTone = {
      ...DEFAULT_CONVERSATION_FLOW,
      awaiting: { type: "choice" as const, topic: "tone" as const },
    };
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "angsty and romantic",
      conversationFlow: awaitingTone,
    });
    expect(hit!.intent).toBe("story_continuation");
  });

  it("(c) weather / current info enables web-search path", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "what's the weather in Mumbai today",
      conversationFlow: awaitingConflict,
    });
    expect(hit).not.toBeNull();
    expect(hit!.intent).toBe("current_information");
    expect(hit!.enableWebSearch).toBe(true);
  });

  it("story write request routes to story_request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "Write episode 1 of my romance story",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("story_request");
  });

  it("platform question does not go to Story Agent", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "How does AFTIONIX Studio credits work?",
      conversationFlow: awaitingConflict,
    });
    expect(hit!.intent).toBe("platform_question");
  });
});

describe("universal intent router — async classify", () => {
  it("does not call LLM when deterministic is confident", async () => {
    const decision = await classifyUniversalIntent({
      userMessage: "what is python",
      conversationFlow: awaitingConflict,
      allowLlm: false,
    });
    expect(decision.intent).toBe("coding_help");
    expect(decision.source).toBe("deterministic");
  });
});

describe("language mirror fragment", () => {
  it("(d) shared fragment is applied via platform identity and language layer", () => {
    expect(mirrorUserLanguageStyle()).toContain("Hinglish");
    expect(MIRROR_USER_LANGUAGE_FRAGMENT).toContain(
      "Never default to English"
    );
    const identity = platformIdentity();
    expect(identity).toContain("LANGUAGE MIRROR");
    expect(identity).toContain("Hinglish");

    const layer = buildLanguageLayer({});
    expect(layer).toContain("LANGUAGE MIRROR");
    expect(layer).toContain(
      'Never "correct" Hinglish into pure Hindi or pure English'
    );
  });

  it("(d2) Hinglish-style inputs are still classified without forcing English-only paths", () => {
    const general = classifyUniversalIntentDeterministic({
      userMessage: "bhai python kya hota hai explain kar do",
      conversationFlow: awaitingConflict,
      allowLlm: false,
    });
    expect(general!.intent).toBe("coding_help");

    const story = classifyUniversalIntentDeterministic({
      userMessage: "un dono ke beech family secret ka conflict rakho",
      conversationFlow: awaitingConflict,
      allowLlm: false,
    });
    expect(story!.intent).toBe("story_continuation");
  });
});
