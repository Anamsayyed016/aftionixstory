export type GenerateTextInput = {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  /** Resolved server-side only — never from client. */
  model?: string;
};

export type GenerateTextResult = {
  text: string;
  provider: string;
  model: string;
  durationMs: number;
  inputCharacters: number;
  outputCharacters: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  requestId?: string;
};

export interface AIProvider {
  readonly name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

export type AIProviderName = "gemini" | "mock";
