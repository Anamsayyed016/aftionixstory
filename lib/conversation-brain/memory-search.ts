/**
 * Memory search stage (Phase 0).
 * Reads structured StoryMemory only — no embeddings / pgvector yet.
 * Later: semantic search behind the same interface.
 */

import type { StoryMemory } from "@/lib/story-agent/schema";
import type { BrainIntent } from "@/lib/conversation-brain/types";

export type MemorySearchQuery = {
  intent: BrainIntent;
  userMessage: string;
  /** Character names hinted by the user message (optional). */
  mentionedNames?: string[];
};

export type MemorySearchResult = {
  characters: StoryMemory["characters"];
  relationships: StoryMemory["relationships"];
  writingRules: StoryMemory["writingRules"];
  preferences: StoryMemory["userPreferences"];
  concept?: string;
  latestDraftPreview?: string;
  /** Labels only — for observability (no prose logged upstream). */
  sectionLabels: string[];
};

/**
 * Select relevant memory slices for the planned intent.
 * Phase 0: heuristic filter; Phase J: vector retrieval via same signature.
 */
export function searchMemory(
  memory: StoryMemory,
  query: MemorySearchQuery
): MemorySearchResult {
  const mentioned = (query.mentionedNames ?? [])
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  const characters =
    mentioned.length === 0
      ? memory.characters
      : memory.characters.filter((c) =>
          mentioned.some(
            (m) =>
              c.name.toLowerCase().includes(m) ||
              m.includes(c.name.toLowerCase())
          )
        );

  const charNames = new Set(characters.map((c) => c.name.toLowerCase()));
  const relationships =
    charNames.size === 0
      ? memory.relationships
      : memory.relationships.filter(
          (r) =>
            charNames.has(r.from.toLowerCase()) ||
            charNames.has(r.to.toLowerCase())
        );

  const includeDraft =
    query.intent === "rewrite" ||
    query.intent === "continue" ||
    query.intent === "scene" ||
    query.intent === "episode";

  const draft = memory.latestDraft?.content?.trim();
  const latestDraftPreview =
    includeDraft && draft
      ? draft.length > 1200
        ? `${draft.slice(0, 1200)}…`
        : draft
      : undefined;

  const sectionLabels = [
    characters.length ? "characters" : "",
    relationships.length ? "relationships" : "",
    memory.writingRules.length ? "writingRules" : "",
    "preferences",
    memory.storyMemory.concept ? "concept" : "",
    latestDraftPreview ? "latestDraft" : "",
  ].filter(Boolean);

  return {
    characters: characters.length > 0 ? characters : memory.characters.slice(0, 8),
    relationships,
    writingRules: memory.writingRules,
    preferences: memory.userPreferences,
    concept: memory.storyMemory.concept,
    latestDraftPreview,
    sectionLabels,
  };
}
