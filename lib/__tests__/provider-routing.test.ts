import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getAIProvider, setAIProviderOverride } from "@/lib/ai/registry";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import {
  looksLikeHardcodedConceptTemplate,
  PROVIDER_FAILURE_USER_MESSAGE,
} from "@/lib/story-agent/concept-reply";
import { __resetEnvCacheForTests, getAiEnv } from "@/lib/env";

describe("Provider routing hardening", () => {
  it("registry resolves openai and gemini", () => {
    __resetEnvCacheForTests();
    process.env.AI_PROVIDER = "openai";
    __resetEnvCacheForTests();
    expect(getAIProvider().name).toBe("openai");

    process.env.AI_PROVIDER = "gemini";
    __resetEnvCacheForTests();
    expect(getAIProvider().name).toBe("gemini");
  });

  it("rejects AI_PROVIDER=local at env parse", () => {
    process.env.AI_PROVIDER = "local";
    __resetEnvCacheForTests();
    expect(() => getAiEnv()).toThrow(/local is not supported/i);
    process.env.AI_PROVIDER = "gemini";
    __resetEnvCacheForTests();
  });

  it("does not import local provider in production registry module", () => {
    const registrySrc = readFileSync(
      path.join(process.cwd(), "lib/ai/registry.ts"),
      "utf8"
    );
    expect(registrySrc).not.toMatch(/providers\/local/);
    expect(registrySrc).not.toMatch(/LocalAIProvider/);
  });

  it("provider failure copy is not a fake story answer", () => {
    expect(looksLikeHardcodedConceptTemplate(PROVIDER_FAILURE_USER_MESSAGE)).toBe(
      false
    );
    expect(PROVIDER_FAILURE_USER_MESSAGE).not.toMatch(/slow-burn/i);
    expect(PROVIDER_FAILURE_USER_MESSAGE).not.toMatch(/core conflict/i);
    expect(PROVIDER_FAILURE_USER_MESSAGE).not.toMatch(/story details are safe/i);
  });

  it("mock is only via explicit DI in this suite", () => {
    setAIProviderOverride(new MockAIProvider());
    expect(getAIProvider().name).toBe("mock");
    setAIProviderOverride(null);
  });
});
