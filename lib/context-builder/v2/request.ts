/**
 * Context request builder (Phase D).
 */

import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import type { IntentEntities, StoryIntent } from "@/lib/conversation-brain/intents";
import {
  contextLimitsSchema,
  DEFAULT_CONTEXT_LIMITS,
  type ContextLimits,
} from "@/lib/context-builder/v2/schema";
import type { StoryMemoryV2 } from "@/lib/story-memory/v2";

export type ContextRequest = {
  intent: StoryIntent | string;
  operation: string;
  userMessage: string;
  entities: IntentEntities;
  conversationFlow?: ConversationFlow | null;
  memory: StoryMemoryV2;
  recentMessages: Array<{ role: string; content: string }>;
  conversationId?: string;
  storyId?: string | null;
  limits?: Partial<ContextLimits>;
  /** POV character for secret filtering (optional). */
  povCharacterId?: string | null;
  /** When true, include author-level secrets. */
  authorPlanning?: boolean;
};

export function normalizeLimits(
  partial?: Partial<ContextLimits>
): ContextLimits {
  return contextLimitsSchema.parse({ ...DEFAULT_CONTEXT_LIMITS, ...partial });
}

export function emptyEntities(): IntentEntities {
  return {
    characterNames: [],
    episodeNumber: null,
    requestedTone: null,
    requestedLanguage: null,
  };
}
