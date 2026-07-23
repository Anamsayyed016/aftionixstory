/**
 * Provider native web-search / grounding wiring (no third-party search APIs).
 */

import { describe, expect, it, vi } from "vitest";

import { OpenAIProvider } from "@/lib/ai/providers/openai";
import type { GenerateTextInput } from "@/lib/ai/types";

describe("OpenAI web_search via Responses API", () => {
  it("uses responses.create with web_search when enableWebSearch is true", async () => {
    const responsesCreate = vi.fn(async () => ({
      output_text: "Mumbai is warm today per search.",
    }));
    const chatCreate = vi.fn();

    const provider = new OpenAIProvider(() => ({
      chat: { completions: { create: chatCreate } },
      responses: { create: responsesCreate },
    }));

    // Bypass env key check by stubbing getAiEnv through real call — need OPENAI_API_KEY.
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-test-key-for-unit";
    try {
      const input: GenerateTextInput = {
        systemInstruction: "sys",
        prompt: "weather in Mumbai",
        enableWebSearch: true,
        model: "gpt-4o-mini",
        operation: "test_web_search",
      };
      const result = await provider.generateText(input);
      expect(result.text).toContain("Mumbai");
      expect(responsesCreate).toHaveBeenCalledTimes(1);
      const arg = responsesCreate.mock.calls[0][0] as {
        tools: Array<{ type: string }>;
      };
      expect(arg.tools).toEqual([{ type: "web_search" }]);
      expect(chatCreate).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });
});
