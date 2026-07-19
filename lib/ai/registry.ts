import "server-only";

import { AIError } from "@/lib/ai/errors";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { LocalAIProvider } from "@/lib/ai/providers/local";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import type { AIProvider, AIProviderName } from "@/lib/ai/types";
import { getAiEnv } from "@/lib/env";

let overrideProvider: AIProvider | null = null;

export function setAIProviderOverride(provider: AIProvider | null) {
  overrideProvider = provider;
}

export function getAIProvider(name?: AIProviderName): AIProvider {
  if (overrideProvider) return overrideProvider;

  const env = getAiEnv();
  const selected = (name || env.AI_PROVIDER) as AIProviderName;

  switch (selected) {
    case "mock":
      return new MockAIProvider();
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
    case "local":
      return new LocalAIProvider();
    default:
      throw new AIError(
        "AI_NOT_CONFIGURED",
        `Unsupported AI provider: ${String(selected)}`,
        false
      );
  }
}
