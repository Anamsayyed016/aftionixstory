export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type GenerateTextInput = {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  /** Resolved server-side only — never from client. */
  model?: string;
  /** Safe operation label for structured logs (never user content). */
  operation?: string;
  /**
   * Explicit output mode. When "text", providers must not force JSON.
   * When "json", providers should request structured JSON when supported.
   * When omitted, providers may infer from prompt content (legacy).
   */
  outputMode?: "text" | "json";
  /**
   * OpenAI reasoning models only. Pass from extraction callers — never from
   * episode/summary writing unless explicitly intended.
   */
  reasoningEffort?: ReasoningEffort;
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
  /** Provider stop reason when available (stop | length | content_filter | …). */
  finishReason?: string;
};

export interface AIProvider {
  readonly name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

export type AIProviderName = "gemini" | "openai" | "mock";
