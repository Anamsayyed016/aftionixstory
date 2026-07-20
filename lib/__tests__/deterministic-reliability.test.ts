import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIError } from "@/lib/ai/errors";
import {
  __resetCircuitBreakersForTests,
  canAttemptProvider,
  getCircuitSnapshot,
  recordProviderTransientFailure,
} from "@/lib/ai/circuit-breaker";
import { generateWithFailover, isTransientFailoverError } from "@/lib/ai/failover";
import { validateGenerateTextRequest } from "@/lib/ai/request-validation";
import { setAIProviderOverride } from "@/lib/ai/registry";
import type { AIProvider, GenerateTextResult } from "@/lib/ai/types";
import { __resetEnvCacheForTests } from "@/lib/env";
import { tryDeterministicTurn } from "@/lib/story-agent/deterministic-router";
import { parseDeterministicMemory } from "@/lib/story-agent/deterministic-memory-parser";
import {
  applyMemoryPatch,
  emptyStoryMemory,
} from "@/lib/story-agent/memory-patch";
import {
  BRAINSTORM_FAILURE_USER_MESSAGE,
  CREATIVE_FAILURE_USER_MESSAGE,
  PROVIDER_FAILURE_USER_MESSAGE,
} from "@/lib/story-agent/concept-reply";
import { friendlyMessageForCode } from "@/lib/story-agent/errors";
import { routeIntent } from "@/lib/story-agent/intent-router";

describe("Deterministic conversation engine", () => {
  it("handles CEO and intern without AI", () => {
    const turn = tryDeterministicTurn("CEO and intern");
    expect(turn.handled).toBe(true);
    expect(turn.aiRequired).toBe(false);
    expect(turn.operation).toBe("memory_update");
    expect(turn.assistantReply).toMatch(/CEO/i);
    expect(turn.assistantReply).toMatch(/Intern/i);
    expect(turn.assistantReply.toLowerCase()).not.toContain("story ideas");

    const next = applyMemoryPatch(emptyStoryMemory(), turn.memoryPatch!);
    expect(next.characters.map((c) => c.name).sort()).toEqual([
      "CEO",
      "Intern",
    ]);
  });

  it("handles Azar male lead without AI", () => {
    const turn = tryDeterministicTurn("Azar male lead");
    expect(turn.handled).toBe(true);
    expect(turn.memoryPatch?.characters[0]?.name).toBe("Azar");
    expect(turn.assistantReply).toMatch(/Azar/);
  });

  it("handles Anaya female lead without AI", () => {
    const turn = tryDeterministicTurn("Anaya female lead");
    expect(turn.handled).toBe(true);
    expect(turn.memoryPatch?.characters[0]?.name).toBe("Anaya");
  });

  it("stores Hinglish preference without AI", () => {
    const turn = tryDeterministicTurn("Hinglish me likho");
    expect(turn.handled).toBe(true);
    expect(turn.intent).toBe("update_preference");
    expect(turn.memoryPatch?.preferences.dialogueLanguage).toMatch(/hinglish/i);
  });

  it("greets hey without AI", () => {
    const turn = tryDeterministicTurn("hey");
    expect(turn.handled).toBe(true);
    expect(turn.intent).toBe("greeting");
    expect(turn.assistantReply.length).toBeGreaterThan(10);
  });

  it("does not deterministically handle brainstorm", () => {
    const turn = tryDeterministicTurn("Suggest three unique stories");
    expect(turn.handled).toBe(false);
    expect(routeIntent("Suggest three unique stories").operation).toBe(
      "brainstorm"
    );
  });

  it("parses relationship corrections", () => {
    const parsed = parseDeterministicMemory(
      "Sameer father nahi uncle hai",
      emptyStoryMemory()
    );
    expect(parsed.matched).toBe(true);
  });

  it("handles style preference: dialogues natural", () => {
    const turn = tryDeterministicTurn("dialogues natural rakho");
    expect(turn.handled).toBe(true);
    expect(turn.intent).toBe("update_preference");
  });

  it("handles control: story start mat karna", () => {
    const turn = tryDeterministicTurn("story start mat karna");
    expect(turn.handled).toBe(true);
    expect(turn.generationBlocked).toBe(true);
  });
});

describe("Error taxonomy / truthful fallbacks", () => {
  it("keeps generic finish message only for chat — not brainstorm/creative", () => {
    expect(PROVIDER_FAILURE_USER_MESSAGE.toLowerCase()).toContain("finish");
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).toContain("ideas");
    expect(BRAINSTORM_FAILURE_USER_MESSAGE.toLowerCase()).not.toContain(
      "finish that reply"
    );
    expect(CREATIVE_FAILURE_USER_MESSAGE.toLowerCase()).toContain("scene");
    expect(
      friendlyMessageForCode("ALL_PROVIDERS_FAILED", "brainstorm")
    ).toMatch(/ideas/i);
    expect(
      friendlyMessageForCode("ALL_PROVIDERS_FAILED", "write_scene")
    ).toMatch(/scene/i);
  });

  it("classifies REQUEST_PARAMETER_INVALID without vague unknown", () => {
    expect(
      friendlyMessageForCode("REQUEST_PARAMETER_INVALID")
    ).not.toMatch(/UNKNOWN/i);
  });
});

describe("Request validation", () => {
  it("rejects empty prompt", () => {
    const v = validateGenerateTextRequest({
      provider: "openai",
      model: "gpt-5-mini",
      systemInstruction: "",
      prompt: "",
      outputMode: "text",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("REQUEST_PARAMETER_INVALID");
  });

  it("rejects OpenAI model id on Gemini", () => {
    const v = validateGenerateTextRequest({
      provider: "gemini",
      model: "gpt-5-mini",
      systemInstruction: "sys",
      prompt: "hi",
      outputMode: "json",
    });
    expect(v.ok).toBe(false);
  });
});

describe("Circuit breaker", () => {
  beforeEach(() => {
    __resetCircuitBreakersForTests();
  });

  it("opens after 3 transient failures", () => {
    const provider = "openai";
    const model = "gpt-5-mini";
    expect(canAttemptProvider(provider, model)).toBe(true);
    recordProviderTransientFailure(provider, model);
    recordProviderTransientFailure(provider, model);
    recordProviderTransientFailure(provider, model);
    expect(getCircuitSnapshot(provider, model).state).toBe("OPEN");
    expect(canAttemptProvider(provider, model)).toBe(false);
  });
});

describe("Provider failover", () => {
  beforeEach(() => {
    __resetCircuitBreakersForTests();
    __resetEnvCacheForTests();
    setAIProviderOverride(null);
    vi.unstubAllEnvs();
  });

  it("treats timeout as transient", () => {
    expect(
      isTransientFailoverError(
        new AIError("AI_TIMEOUT", "timeout", true, 504)
      )
    ).toBe(true);
    expect(
      isTransientFailoverError(
        new AIError("AI_QUOTA_EXCEEDED", "quota", false, 429)
      )
    ).toBe(false);
    expect(
      isTransientFailoverError(
        new AIError("AI_NOT_CONFIGURED", "auth", false, 401)
      )
    ).toBe(false);
  });

  it("uses provider override without dual fan-out", async () => {
    let calls = 0;
    const mock: AIProvider = {
      name: "mock",
      async generateText(): Promise<GenerateTextResult> {
        calls += 1;
        return {
          text: '{"assistantReply":"ok","intent":"chat","requiresConfirmation":false,"clarificationQuestion":null,"memoryPatch":{"story":{},"characters":[],"relationships":[],"writingRules":[],"preferences":{},"remove":[]},"action":{"type":"none","payload":{}},"suggestions":[]}',
          provider: "mock",
          model: "mock",
          durationMs: 1,
          inputCharacters: 10,
          outputCharacters: 10,
        };
      },
    };
    setAIProviderOverride(mock);
    const result = await generateWithFailover({
      providerOverride: mock,
      input: {
        systemInstruction: "sys",
        prompt: "Suggest three unique stories",
        outputMode: "json",
        operation: "test",
      },
    });
    expect(result.text).toContain("assistantReply");
    expect(result.failoverUsed).toBe(false);
    expect(calls).toBe(1);
    setAIProviderOverride(null);
  });
});
