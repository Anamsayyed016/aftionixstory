/**
 * Conversation-state memory repository (JSON only — Phase C).
 * Prepares interface for later Prisma/RAG repositories.
 */

import { applyMemoryV2Patch } from "@/lib/story-memory/v2/merge";
import {
  normalizeName,
  normalizeLocationKey,
} from "@/lib/story-memory/v2/normalize";
import type { MemoryV2Patch } from "@/lib/story-memory/v2/patch";
import type {
  CharacterV2,
  ContinuityV2,
  LocationV2,
  OpenThreadV2,
  RelationshipV2,
  StoryMemoryV2,
} from "@/lib/story-memory/v2/schema";
import { storyMemoryV2Schema } from "@/lib/story-memory/v2/schema";
import { emptyStoryMemoryV2 } from "@/lib/story-memory/v2/defaults";
import { upgradeStoryMemory } from "@/lib/story-memory/v2/upgrade";

export interface StoryMemoryRepository {
  getMemory(): StoryMemoryV2;
  upgradeMemory(input?: unknown): StoryMemoryV2;
  applyPatch(
    patch: MemoryV2Patch | unknown,
    opts?: { allowConflicts?: boolean }
  ): {
    memory: StoryMemoryV2;
    stale: boolean;
    warnings: string[];
    needsClarification: boolean;
  };
  /** Optional — used by tool executor for transactional rollback */
  replaceMemory?(memory: StoryMemoryV2): void;
  findCharacterByName(name: string): CharacterV2 | null;
  findRelationship(params: {
    fromName?: string;
    toName?: string;
    fromId?: string;
    toId?: string;
    type?: string;
    includeSuperseded?: boolean;
  }): RelationshipV2 | null;
  findLocationByName(name: string): LocationV2 | null;
  listOpenThreads(status?: OpenThreadV2["status"]): OpenThreadV2[];
  getContinuity(): ContinuityV2;
  validateMemory(memory?: StoryMemoryV2): {
    ok: boolean;
    issues: string[];
  };
}

export class ConversationStateMemoryRepository implements StoryMemoryRepository {
  private memory: StoryMemoryV2;

  constructor(initial?: unknown) {
    this.memory = initial
      ? upgradeStoryMemory(initial)
      : emptyStoryMemoryV2();
  }

  getMemory(): StoryMemoryV2 {
    return this.memory;
  }

  upgradeMemory(input?: unknown): StoryMemoryV2 {
    this.memory = upgradeStoryMemory(input ?? this.memory);
    return this.memory;
  }

  applyPatch(
    patch: MemoryV2Patch | unknown,
    opts?: { allowConflicts?: boolean }
  ) {
    const result = applyMemoryV2Patch(this.memory, patch, opts);
    if (!result.stale) {
      this.memory = result.memory;
    }
    return result;
  }

  /** Atomic rollback support for Story Tool Framework */
  replaceMemory(memory: StoryMemoryV2): void {
    this.memory = storyMemoryV2Schema.parse(memory);
  }

  findCharacterByName(name: string): CharacterV2 | null {
    const key = normalizeName(name);
    return (
      this.memory.characters.find(
        (c) =>
          normalizeName(c.name) === key ||
          c.aliases.some((a) => normalizeName(a) === key)
      ) ?? null
    );
  }

  findRelationship(params: {
    fromName?: string;
    toName?: string;
    fromId?: string;
    toId?: string;
    type?: string;
    includeSuperseded?: boolean;
  }): RelationshipV2 | null {
    const fromId =
      params.fromId ||
      (params.fromName
        ? this.findCharacterByName(params.fromName)?.id
        : undefined);
    const toId =
      params.toId ||
      (params.toName ? this.findCharacterByName(params.toName)?.id : undefined);

    const list = params.includeSuperseded
      ? this.memory.relationships
      : this.memory.relationships.filter(
          (r) => r.status !== "superseded" && r.status !== "corrected"
        );

    return (
      list.find((r) => {
        const pair =
          (fromId &&
            toId &&
            ((r.fromCharacterId === fromId && r.toCharacterId === toId) ||
              (r.fromCharacterId === toId && r.toCharacterId === fromId))) ||
          false;
        if (fromId && toId && !pair) return false;
        if (params.type) {
          return r.type.toLowerCase().includes(params.type.toLowerCase());
        }
        return Boolean(pair);
      }) ?? null
    );
  }

  findLocationByName(name: string): LocationV2 | null {
    const key = normalizeLocationKey(name);
    return (
      this.memory.locations.find(
        (l) => normalizeLocationKey(l.name) === key
      ) ?? null
    );
  }

  listOpenThreads(status?: OpenThreadV2["status"]): OpenThreadV2[] {
    if (!status) return [...this.memory.openThreads];
    return this.memory.openThreads.filter((t) => t.status === status);
  }

  getContinuity(): ContinuityV2 {
    return this.memory.continuity;
  }

  validateMemory(memory?: StoryMemoryV2): { ok: boolean; issues: string[] } {
    const target = memory ?? this.memory;
    const parsed = storyMemoryV2Schema.safeParse(target);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map((i) => i.message),
      };
    }
    const issues: string[] = [];
    const ids = new Set(parsed.data.characters.map((c) => c.id));
    for (const rel of parsed.data.relationships) {
      if (!ids.has(rel.fromCharacterId) || !ids.has(rel.toCharacterId)) {
        issues.push(`dangling_relationship:${rel.id}`);
      }
    }
    return { ok: issues.length === 0, issues };
  }
}
