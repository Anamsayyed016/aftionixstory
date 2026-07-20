/**
 * Safe memory summary for logs — never includes full draft/prose.
 */

import type { StoryMemoryV2 } from "@/lib/story-memory/v2/schema";

export type MemoryLogSummary = {
  memoryVersion: number;
  characterCount: number;
  relationshipCount: number;
  locationCount: number;
  objectCount: number;
  eventCount: number;
  timelineCount: number;
  openThreadCount: number;
  secretCount: number;
  promiseCount: number;
  worldRuleCount: number;
  writingRuleCount: number;
  conflictCount: number;
  correctionCount: number;
  revision: number;
  hasLatestDraft: boolean;
  draftWordCount: number | null;
  storyStatus: string | null;
  hasTitle: boolean;
  hasConcept: boolean;
};

export function summarizeMemoryForLogs(memory: StoryMemoryV2): MemoryLogSummary {
  return {
    memoryVersion: memory.memoryVersion,
    characterCount: memory.characters.length,
    relationshipCount: memory.relationships.length,
    locationCount: memory.locations.length,
    objectCount: memory.objects.length,
    eventCount: memory.events.length,
    timelineCount: memory.timeline.length,
    openThreadCount: memory.openThreads.length,
    secretCount: memory.secrets.length,
    promiseCount: memory.promises.length,
    worldRuleCount: memory.worldRules.length,
    writingRuleCount: memory.writingRules.length,
    conflictCount: memory.metadata.memoryConflicts.length,
    correctionCount: memory.metadata.correctionHistory.length,
    revision: memory.metadata.revision,
    hasLatestDraft: Boolean(memory.latestDraft?.content?.trim()),
    draftWordCount: memory.latestDraft?.wordCount ?? null,
    storyStatus: memory.story.status ?? null,
    hasTitle: Boolean(memory.story.title),
    hasConcept: Boolean(memory.story.concept),
  };
}
