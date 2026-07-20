import { describe, expect, it } from "vitest";

import { parseAgentDecisionResilient } from "@/lib/ai/services/story-agent";
import {
  BRAINSTORM_FAILURE_USER_MESSAGE,
  looksLikeHardcodedConceptTemplate,
} from "@/lib/story-agent/concept-reply";
import { routeIntent } from "@/lib/story-agent/intent-router";

describe("Serialized unique suggestion routing", () => {
  it("routes Create Story chip prompt to brainstorm", () => {
    const route = routeIntent(
      "Suggest something unique for a serialized story"
    );
    expect(route.operation).toBe("brainstorm");
    expect(route.fixedReply).toBeUndefined();
  });
});

describe("Brainstorm parse resilience", () => {
  it("recovers assistantReply when intent is non-enum", () => {
    const raw = JSON.stringify({
      assistantReply:
        "Bilkul ✨ Ye 3 serialized concepts strong rahenge:\n1. Clockwork City — each episode a new district rule.\n2. Twin Signal — siblings share one body on alternate nights.\n3. Archive Ghost — deleted chat logs rewrite the past.",
      intent: "suggest_options",
      action: { type: "suggest_options", payload: {} },
      suggestions: [],
    });
    const parsed = parseAgentDecisionResilient(raw, {
      preferIntent: "brainstorm",
    });
    expect(parsed.assistantReply.toLowerCase()).toContain("serialized");
    expect(parsed.intent).toBe("brainstorm");
  });

  it("accepts plain-text brainstorm answers", () => {
    const plain =
      "Here are three unique serialized openings:\n1. A courier delivers memories.\n2. A lighthouse broadcasts dreams.\n3. A school timetable predicts deaths.";
    const parsed = parseAgentDecisionResilient(plain, {
      preferIntent: "brainstorm",
    });
    expect(parsed.assistantReply).toContain("courier");
  });
});

describe("Brainstorm failure copy", () => {
  it("does not claim story details are safe by default", () => {
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).toContain(
      "story ideas"
    );
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story details are safe"
    );
    expect(
      looksLikeHardcodedConceptTemplate(BRAINSTORM_FAILURE_USER_MESSAGE)
    ).toBe(false);
  });
});
