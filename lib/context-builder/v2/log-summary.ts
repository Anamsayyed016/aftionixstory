/**
 * Safe context log summary — no prose / draft text.
 */

import type { DynamicContext } from "@/lib/context-builder/v2/schema";

export type ContextLogSummary = {
  operation: string;
  intent?: string;
  characterCount: number;
  relationshipCount: number;
  locationCount: number;
  eventCount: number;
  openThreadCount: number;
  writingRuleCount: number;
  recentMessageCount: number;
  estimatedTokens: number;
  truncated: boolean;
  truncatedDraft: boolean;
  hasLatestDraft: boolean;
  hasStory: boolean;
};

export function summarizeContextForLogs(
  ctx: DynamicContext
): ContextLogSummary {
  return {
    operation: ctx.operation,
    intent: ctx.intent,
    characterCount: ctx.characters.length,
    relationshipCount: ctx.relationships.length,
    locationCount: ctx.locations.length,
    eventCount: ctx.events.length,
    openThreadCount: ctx.openThreads.length,
    writingRuleCount: ctx.writingRules.length,
    recentMessageCount: ctx.recentConversation.length,
    estimatedTokens: ctx.retrieval.estimatedTokens,
    truncated: ctx.retrieval.truncated,
    truncatedDraft: ctx.retrieval.truncatedDraft,
    hasLatestDraft: Boolean(ctx.latestDraft?.content),
    hasStory: Boolean(ctx.story.concept || ctx.story.title),
  };
}
