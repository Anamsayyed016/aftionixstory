import type { AIProvider, GenerateTextInput, GenerateTextResult } from "@/lib/ai/types";
import { estimateTokensFromCharacters } from "@/lib/ai/token-estimator";

/**
 * Deterministic mock provider for tests and offline development.
 * Not registered for production use unless AI_PROVIDER=mock.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  constructor(
    private readonly handler?: (
      input: GenerateTextInput
    ) => Promise<string> | string
  ) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const started = Date.now();
    const inputCharacters =
      input.systemInstruction.length + input.prompt.length;

    const text = this.handler
      ? await this.handler(input)
      : [
          "Title: Mock Episode",
          "",
          "The characters gathered under a quiet sky. Dialogue followed with measured pacing,",
          "honoring established personalities and the user's instruction:",
          input.prompt.slice(-200),
        ].join("\n");

    const outputCharacters = text.length;
    return {
      text,
      provider: this.name,
      model: "mock-model",
      durationMs: Date.now() - started,
      inputCharacters,
      outputCharacters,
      estimatedInputTokens: estimateTokensFromCharacters(inputCharacters),
      estimatedOutputTokens: estimateTokensFromCharacters(outputCharacters),
    };
  }
}
