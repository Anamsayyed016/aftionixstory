/**
 * Prompt Registry types (Phase E).
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type { DynamicContext } from "@/lib/context-builder/v2/schema";
import type { PromptId } from "@/lib/prompt-registry/ids";
import type {
  JsonModeHint,
  MaxOutputTokensProfile,
  ProviderHints,
  ReasoningProfile,
  TemperatureProfile,
} from "@/lib/prompt-registry/provider-hints";

export type PromptCategory =
  | "conversation"
  | "story"
  | "character"
  | "relationship"
  | "creative"
  | "revision"
  | "knowledge"
  | "memory"
  | "preference"
  | "internal";

export type PromptOutputMode = "text" | "json";

export type PromptMessageRole = "system" | "user" | "assistant";

export type PromptMessage = {
  role: PromptMessageRole;
  content: string;
};

export type PromptRequestMetadata = {
  turnRequestId?: string;
  conversationId?: string;
  promptVersionOverride?: string | null;
  preferOfferType?: string;
  openConceptKind?: string;
  intentContextSummary?: string;
  revisionFocus?: string;
};

export type PromptRequest = {
  promptId: PromptId;
  intent: string;
  operation: string;
  userMessage: string;
  context: DynamicContext;
  conversationFlow?: ConversationFlow | null;
  outputMode?: PromptOutputMode;
  locale?: string;
  metadata?: PromptRequestMetadata;
};

export type PromptResultDebug = {
  includedSections: string[];
  estimatedPromptTokens: number;
  conflictResolutions?: string[];
};

export type PromptResult = {
  promptId: PromptId;
  promptVersion: string;
  outputMode: PromptOutputMode;
  messages: PromptMessage[];
  providerHints: ProviderHints;
  debug: PromptResultDebug;
};

export type PromptDefinition = {
  id: PromptId;
  version: string;
  category: PromptCategory;
  description: string;
  supportedIntents: string[];
  outputMode: PromptOutputMode;
  contextProfile: string;
  temperatureProfile: TemperatureProfile;
  maxOutputTokensProfile: MaxOutputTokensProfile;
  reasoningProfile?: ReasoningProfile;
  jsonMode?: JsonModeHint;
  requiresDraft: boolean;
  requiredContextSections: string[];
  /** When false, definition is stub metadata only. */
  enabled: boolean;
  builder: (request: PromptRequest) => PromptResult;
};

export type PromptLogSummary = {
  promptId: PromptId;
  promptVersion: string;
  outputMode: PromptOutputMode;
  messageCount: number;
  estimatedPromptTokens: number;
  includedSections: string[];
};
