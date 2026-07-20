import { describe, expect, it } from "vitest";

import { buildBrainstormPrompt } from "@/lib/ai/prompts/brainstorm-prompt";
import { buildConversationUserPrompt } from "@/lib/ai/prompts/conversation-prompt";
import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import { getAIProvider, setAIProviderOverride } from "@/lib/ai/registry";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import {
  extractStoryConcept,
  isConceptCreateRequest,
  looksLikeHardcodedConceptTemplate,
  PROVIDER_FAILURE_USER_MESSAGE,
} from "@/lib/story-agent/concept-reply";
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";
import { __resetEnvCacheForTests, getAiEnv } from "@/lib/env";
import { CREATE_SUGGESTIONS } from "@/lib/chat/constants";

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

describe("No fake concept template in product path", () => {
  it("detects the obsolete hardcoded template", () => {
    expect(
      looksLikeHardcodedConceptTemplate(
        "Bilkul ❤️ “forbidden romance” ko hum emotional, slow-burn, ya intense direction me build kar sakte hain. Aap kis type ka core conflict chahti ho—family, age gap, ya secret?"
      )
    ).toBe(true);
    expect(
      looksLikeHardcodedConceptTemplate(
        "Here are three unique openings for your two characters."
      )
    ).toBe(false);
  });

  it("exposes a non-creative provider failure message", () => {
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).toContain("retry");
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "slow-burn"
    );
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "story details are safe"
    );
  });

  it("extracts topics without inventing user-facing answers", () => {
    const horror = extractStoryConcept("Help me create a horror story");
    expect(horror.genreHints).toContain("horror");
    expect(horror.topicLabel.toLowerCase()).toContain("horror");
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

describe("Provider registry runtime", () => {
  it("supports openai and gemini; rejects local", () => {
    __resetEnvCacheForTests();
    process.env.AI_PROVIDER = "openai";
    __resetEnvCacheForTests();
    expect(getAiEnv().AI_PROVIDER).toBe("openai");
    expect(getAIProvider().name).toBe("openai");

    process.env.AI_PROVIDER = "gemini";
    __resetEnvCacheForTests();
    expect(getAIProvider().name).toBe("gemini");

    process.env.AI_PROVIDER = "local";
    __resetEnvCacheForTests();
    expect(() => getAiEnv()).toThrow(/local is not supported/i);

    process.env.AI_PROVIDER = "gemini";
    __resetEnvCacheForTests();
    setAIProviderOverride(new MockAIProvider());
    expect(getAIProvider().name).toBe("mock");
    setAIProviderOverride(null);
    __resetEnvCacheForTests();
  });
});
