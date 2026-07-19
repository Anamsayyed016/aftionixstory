import { describe, expect, it } from "vitest";

import { CREATE_SUGGESTIONS } from "@/lib/chat/constants";
import { buildBrainstormPrompt } from "@/lib/ai/prompts/brainstorm-prompt";
import { buildConversationUserPrompt } from "@/lib/ai/prompts/conversation-prompt";
import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import {
  buildConceptBrainstormReply,
  isConceptCreateRequest,
  looksLikeOnboardingGreeting,
  responseMentionsTopic,
} from "@/lib/story-agent/concept-reply";
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";

describe("Concept create routing", () => {
  it("routes forbidden romance help to brainstorm", () => {
    const route = routeIntent("Help me create a forbidden romance");
    expect(route.operation).toBe("brainstorm");
    expect(route.reason).toBe("concept_create_request");
    expect(route.fixedReply).toBeUndefined();
  });

  it("routes horror / thriller / fantasy concept requests to brainstorm", () => {
    expect(routeIntent("Help me create a horror story").operation).toBe(
      "brainstorm"
    );
    expect(routeIntent("hey, I want a thriller").operation).toBe("brainstorm");
    expect(routeIntent("I want a fantasy story").operation).toBe("brainstorm");
    expect(routeIntent("Make a family drama").operation).toBe("brainstorm");
    expect(routeIntent("Suggest a horror concept").operation).toBe(
      "brainstorm"
    );
  });

  it("allows greeting-only replies for bare hey", () => {
    const route = routeIntent("hey");
    expect(route.operation).toBe("conversational_chat");
    expect(route.reason).toBe("greeting_or_help");
    expect(route.fixedReply).toMatch(/Apna rough story idea batao/i);
  });

  it("does not treat concept requests as greetings", () => {
    expect(isConceptCreateRequest("Help me create a forbidden romance")).toBe(
      true
    );
    expect(isConceptCreateRequest("hey")).toBe(false);
  });
});

describe("Concept reply + relevance", () => {
  it("builds topic-aware reply without hardcoding only romance", () => {
    const romance = buildConceptBrainstormReply(
      "Help me create a forbidden romance"
    );
    expect(romance.assistantReply.toLowerCase()).toContain("forbidden romance");
    expect(looksLikeOnboardingGreeting(romance.assistantReply)).toBe(false);
    expect(responseMentionsTopic(romance.assistantReply, "forbidden romance")).toBe(
      true
    );

    const horror = buildConceptBrainstormReply("Help me create a horror story");
    expect(horror.assistantReply.toLowerCase()).toContain("horror");
    expect(horror.assistantReply.toLowerCase()).not.toContain(
      "forbidden romance"
    );
  });

  it("detects onboarding greeting as low-relevance", () => {
    expect(
      looksLikeOnboardingGreeting(
        "Hey! 😊 Apna rough story idea batao—ek character, scene, ya sirf ek feeling bhi chalegi."
      )
    ).toBe(true);
  });
});

describe("Suggestion chip prompts", () => {
  it("sends the forbidden-romance prompt equal to the label", () => {
    const chip = CREATE_SUGGESTIONS.find(
      (s) => s.id === "create-forbidden-romance"
    );
    expect(chip).toBeDefined();
    expect(chip!.prompt).toBe("Help me create a forbidden romance");
    expect(chip!.label).toBe(chip!.prompt);
  });
});

describe("Prompt source of truth", () => {
  it("puts CURRENT USER MESSAGE first in brainstorm and conversation prompts", () => {
    const memory = emptyStoryMemory();
    const ctx = buildStoryContext({
      operation: "brainstorm",
      memory,
      userMessage: "Help me create a forbidden romance",
      recentMessages: [],
    });
    const brainstorm = buildBrainstormPrompt(ctx);
    expect(brainstorm.prompt).toMatch(/^CURRENT USER MESSAGE:/);
    expect(brainstorm.prompt).toContain("Help me create a forbidden romance");
    expect(brainstorm.system.toLowerCase()).toContain("never ignore");

    const chat = buildConversationUserPrompt(ctx);
    expect(chat).toMatch(/^CURRENT USER MESSAGE:/);
    expect(chat).toContain("Help me create a forbidden romance");
  });
});
