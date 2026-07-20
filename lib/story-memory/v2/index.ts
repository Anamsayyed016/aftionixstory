/**
 * Memory Model v2 — public exports (Phase C).
 */

export {
  MEMORY_VERSION,
  MEMORY_SOFT_CAPS,
  storyMemoryV2Schema,
  type StoryMemoryV2,
  type CharacterV2,
  type RelationshipV2,
  type LocationV2,
  type ObjectV2,
  type EventV2,
  type TimelineV2,
  type OpenThreadV2,
  type SecretV2,
  type PromiseV2,
  type WorldRuleV2,
  type WritingRuleV2,
  type ContinuityV2,
  type UserPreferencesV2,
  type MemoryConflict,
  type CorrectionRecord,
} from "@/lib/story-memory/v2/schema";

export { emptyStoryMemoryV2 } from "@/lib/story-memory/v2/defaults";
export { upgradeStoryMemory } from "@/lib/story-memory/v2/upgrade";
export {
  applyMemoryV2Patch,
  type ApplyPatchResult,
} from "@/lib/story-memory/v2/merge";
export {
  memoryV2PatchSchema,
  type MemoryV2Patch,
} from "@/lib/story-memory/v2/patch";
export {
  ConversationStateMemoryRepository,
  type StoryMemoryRepository,
} from "@/lib/story-memory/v2/repository";
export {
  toLegacyStoryMemory,
  legacyPatchToMemoryV2Patch,
  memoryV2ToPersistedState,
  loadMemoryV2FromState,
} from "@/lib/story-memory/v2/legacy-adapter";
export {
  summarizeMemoryForLogs,
  type MemoryLogSummary,
} from "@/lib/story-memory/v2/log-summary";
export {
  normalizeName,
  normalizeKey,
  normalizeRuleText,
  stableId,
} from "@/lib/story-memory/v2/normalize";
