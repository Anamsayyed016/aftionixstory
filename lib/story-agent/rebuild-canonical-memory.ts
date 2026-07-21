/**
 * Rebuild canonical memory from the earliest substantive user synopsis.
 * Development / admin repair for poisoned conversations.
 */

import {
  buildCanonicalStoryContext,
  extractCanonicalNamesFromSynopsis,
  isSubstantiveStoryMessage,
} from "@/lib/story-agent/canonical-story-context";
import {
  applyMemoryPatch,
  emptyStoryMemory,
} from "@/lib/story-agent/memory-patch";
import { sanitizeStoryMemoryCanon } from "@/lib/story-agent/sanitize-memory";
import type { StoryMemory } from "@/lib/story-agent/schema";

export function rebuildCanonicalMemoryFromMessages(params: {
  conversationId: string;
  storyId?: string | null;
  messages: Array<{ role: string; content: string }>;
  latestInstruction?: string;
}): {
  memory: StoryMemory;
  canonical: ReturnType<typeof buildCanonicalStoryContext>;
  removedCharacterNames: string[];
} {
  const synopsis =
    params.messages.find(
      (message) =>
        message.role === "user" && isSubstantiveStoryMessage(message.content)
    )?.content ?? "";
  const names = extractCanonicalNamesFromSynopsis(synopsis);
  let memory = emptyStoryMemory();
  if (synopsis.trim()) {
    memory = applyMemoryPatch(memory, {
      story: {
        concept: synopsis.slice(0, 2000),
        plot: synopsis.slice(0, 2000),
      },
      characters: names.map((name) => ({
        name,
        personality: [],
        goals: [],
        conflicts: [],
        notes: ["rebuilt_from_synopsis"],
        avoid: [],
      })),
    });
  }
  const sanitized = sanitizeStoryMemoryCanon(memory);
  const canonical = buildCanonicalStoryContext({
    conversationId: params.conversationId,
    storyId: params.storyId,
    memory: sanitized.memory,
    recentMessages: params.messages,
    latestInstruction: params.latestInstruction ?? synopsis,
  });
  return {
    memory: sanitized.memory,
    canonical,
    removedCharacterNames: sanitized.removedCharacterNames,
  };
}
