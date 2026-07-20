/**
 * Memory v2 defaults and empty factories.
 */

import {
  storyMemoryV2Schema,
  type StoryMemoryV2,
} from "@/lib/story-memory/v2/schema";

export function emptyStoryMemoryV2(): StoryMemoryV2 {
  return storyMemoryV2Schema.parse({
    memoryVersion: 2,
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
