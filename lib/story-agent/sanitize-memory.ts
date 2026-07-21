/**
 * Strip pseudo-entities and invalid names from conversational story memory.
 * Used when rebuilding canon and when loading legacy poisoned conversations.
 */

import { isValidCanonicalEntityName } from "@/lib/story-agent/entity-guards";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import { toLegacyStoryMemory } from "@/lib/story-memory/v2";

export function sanitizeStoryMemoryCanon(memory: StoryMemory): {
  memory: StoryMemory;
  removedCharacterNames: string[];
  changed: boolean;
} {
  const before = memory.characters.map((character) => character.name);
  const characters = memory.characters.filter((character) =>
    isValidCanonicalEntityName(character.name)
  );
  const validNames = new Set(
    characters.map((character) => character.name.toLowerCase())
  );
  const relationships = memory.relationships.filter(
    (relationship) =>
      isValidCanonicalEntityName(relationship.from) &&
      isValidCanonicalEntityName(relationship.to) &&
      validNames.has(relationship.from.toLowerCase()) &&
      validNames.has(relationship.to.toLowerCase())
  );

  const removedCharacterNames = before.filter(
    (name) => !isValidCanonicalEntityName(name)
  );

  const changed =
    removedCharacterNames.length > 0 ||
    relationships.length !== memory.relationships.length;

  if (!changed) {
    return { memory, removedCharacterNames: [], changed: false };
  }

  const next: StoryMemory = {
    ...memory,
    characters,
    relationships,
    updatedAt: new Date().toISOString(),
  };

  // Keep v2 surface in sync when present.
  try {
    const v2 = getMemoryV2(next);
    const cleanedV2 = {
      ...v2,
      characters: v2.characters.filter((character) =>
        isValidCanonicalEntityName(character.name)
      ),
      relationships: v2.relationships.filter((relationship) => {
        const from = v2.characters.find((c) => c.id === relationship.fromCharacterId);
        const to = v2.characters.find((c) => c.id === relationship.toCharacterId);
        return (
          Boolean(from && isValidCanonicalEntityName(from.name)) &&
          Boolean(to && isValidCanonicalEntityName(to.name))
        );
      }),
    };
    const legacy = toLegacyStoryMemory(cleanedV2);
    return {
      memory: Object.assign(legacy, {
        memoryVersion: 2,
        __memoryV2: cleanedV2,
      }) as StoryMemory,
      removedCharacterNames,
      changed: true,
    };
  } catch {
    return { memory: next, removedCharacterNames, changed: true };
  }
}

export function hasPoisonedCanonicalNames(names: string[]): boolean {
  return names.some((name) => !isValidCanonicalEntityName(name));
}
