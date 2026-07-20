import type { StoryOperation } from "@/lib/story-agent/operations";
import type { MemoryPatch, StoryMemory } from "@/lib/story-agent/schema";

export type DraftKind = "scene" | "episode" | "rewrite";

export type CreativeDraftPayload = {
  title?: string;
  content: string;
  wordCount: number;
  draftKind: DraftKind;
  saved: false;
  clientRequestId: string;
};

export type StorySuggestion = { label: string; prompt: string };

export type StoryOperationResult =
  | {
      type: "conversation";
      operation: StoryOperation;
      assistantReply: string;
      suggestions?: StorySuggestion[];
      memoryPatch?: MemoryPatch;
      showReview?: boolean;
    }
  | {
      type: "creative_draft";
      operation: StoryOperation;
      assistantReply: string;
      draft: CreativeDraftPayload;
      suggestions?: StorySuggestion[];
      memoryPatch?: MemoryPatch;
    }
  | {
      type: "structured_action";
      operation: StoryOperation;
      assistantReply: string;
      actionType: string;
      actionOk: boolean;
      storyId?: string | null;
      draft?: CreativeDraftPayload | null;
      suggestions?: StorySuggestion[];
      memoryPatch?: MemoryPatch;
      showReview?: boolean;
      requiresConfirmation?: boolean;
    }
  | {
      type: "error";
      operation: StoryOperation;
      code: string;
      message: string;
      retryable: boolean;
    };

export type NormalizedTurnResult = {
  resultType: StoryOperationResult["type"];
  operation: StoryOperation;
  assistantReply: string;
  suggestions: StorySuggestion[];
  memory: StoryMemory;
  storyId: string | null;
  draft: CreativeDraftPayload | null;
  showReview: boolean;
  actionType: string;
  actionOk: boolean;
  requiresConfirmation: boolean;
  provider?: string;
  model?: string;
  outputMode?: "structured" | "text" | "none";
  durationMs?: number;
  retryCount?: number;
  errorCode?: string;
  retryable?: boolean;
  /** Phase A collaboration flow (optional on legacy executor results). */
  conversationFlow?: import("@/lib/conversation-brain/collaboration-state").ConversationFlow;
  /** Phase E prompt registry metadata (never full prompt text). */
  promptId?: string;
  promptVersion?: string;
};
