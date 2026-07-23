/**
 * General AI handler — language mirror on system prompt (mocked provider call).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const generateTextCompat = vi.fn(async (params: {
  input: { systemInstruction: string; prompt: string; enableWebSearch?: boolean };
}) => ({
  text: "Haan bhai, Python ek programming language hai.",
  provider: "mock",
  model: "mock",
  durationMs: 1,
  inputCharacters: 10,
  outputCharacters: 40,
}));

vi.mock("@/lib/provider-router/v2/legacy-generate", () => ({
  generateTextCompat: (...args: unknown[]) => generateTextCompat(...args),
}));

describe("general AI language mirror", () => {
  beforeEach(() => {
    generateTextCompat.mockClear();
  });

  it("(d) general path system prompt requires Hinglish-style mirroring", async () => {
    const { runGeneralAiTurn } = await import(
      "@/lib/universal-router/general-handler"
    );
    const result = await runGeneralAiTurn({
      userMessage: "bhai python kya hota hai",
      intent: "coding_help",
    });

    expect(generateTextCompat).toHaveBeenCalledTimes(1);
    const call = generateTextCompat.mock.calls[0][0] as {
      input: { systemInstruction: string; enableWebSearch?: boolean };
    };
    expect(call.input.systemInstruction).toContain("LANGUAGE MIRROR");
    expect(call.input.systemInstruction).toContain("Hinglish");
    expect(call.input.enableWebSearch).toBe(false);
    expect(result.assistantReply.toLowerCase()).toContain("python");
  });

  it("(c) current_information enables web search on the provider call", async () => {
    const { runGeneralAiTurn } = await import(
      "@/lib/universal-router/general-handler"
    );
    await runGeneralAiTurn({
      userMessage: "what's the weather in Mumbai today",
      intent: "current_information",
      enableWebSearch: true,
    });
    const call = generateTextCompat.mock.calls[0][0] as {
      input: { enableWebSearch?: boolean };
    };
    expect(call.input.enableWebSearch).toBe(true);
  });
});
