import "server-only";

import { AIError } from "@/lib/ai/errors";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import type { AIProvider, AIProviderName } from "@/lib/ai/types";
import { getAiEnv } from "@/lib/env";

let overrideProvider: AIProvider | null = null;

/** Test-only dependency injection. Never used for production routing. */
export function setAIProviderOverride(provider: AIProvider | null) {
  overrideProvider = provider;
}

/**
 * Resolve the active AI provider.
 * Production runtime supports only OpenAI and Gemini.
 * Mock is allowed via explicit override (tests) or AI_PROVIDER=mock outside production.
 */
export function getAIProvider(name?: AIProviderName): AIProvider {
  if (overrideProvider) return overrideProvider;

  const env = getAiEnv();
  const selected = (name || env.AI_PROVIDER) as string;

  switch (selected) {
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
    case "mock":
      if (process.env.NODE_ENV === "production") {
        throw new AIError(
          "AI_NOT_CONFIGURED",
          "AI_PROVIDER=mock is not allowed in production. Use openai or gemini.",
          false
        );
      }
      return new MockAIProvider();
    case "local":
      throw new AIError(
        "AI_NOT_CONFIGURED",
        "AI_PROVIDER=local is not supported yet. Use openai or gemini.",
        false
      );
    default:
      throw new AIError(
        "AI_NOT_CONFIGURED",
        `Unsupported AI provider: ${String(selected)}. Use openai or gemini.`,
        false
      );
  }
}
