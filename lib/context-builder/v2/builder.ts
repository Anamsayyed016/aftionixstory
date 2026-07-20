/**
 * Dynamic Context Builder v2 — main entry (Phase D).
 * Deterministic, no provider calls, no full StoryMemory dump.
 */

import { selectLatestDraft } from "@/lib/context-builder/v2/draft";
import {
  mergeLimits,
  resolveOperationProfile,
} from "@/lib/context-builder/v2/profiles";
import {
  emptyEntities,
  normalizeLimits,
  type ContextRequest,
} from "@/lib/context-builder/v2/request";
import {
  dynamicContextSchema,
  DEFAULT_CONTEXT_LIMITS,
  type DynamicContext,
  type ScoredEntityMeta,
} from "@/lib/context-builder/v2/schema";
import {
  selectCharacters,
  selectConversation,
  selectEvents,
  selectLocations,
  selectPreferences,
  selectPromises,
  selectRelationships,
  selectSecrets,
  selectThreads,
  selectWritingRules,
} from "@/lib/context-builder/v2/select";
import {
  estimateContextTokens,
  pruneToBudget,
} from "@/lib/context-builder/v2/token-budget";
import { isInstructionFidelityEnabled } from "@/lib/story-fidelity/feature-flag";
import {
  buildStoryGenerationContract,
  serializeGenerationContract,
} from "@/lib/story-fidelity/generation-contract";
import { readFidelityState } from "@/lib/story-fidelity/resolve-facts";
import { toLegacyStoryMemory } from "@/lib/story-memory/v2";

export function buildDynamicContext(req: ContextRequest): DynamicContext {
  const profile = resolveOperationProfile(req.intent, req.operation);
  const limits = mergeLimits(
    DEFAULT_CONTEXT_LIMITS,
    profile,
    normalizeLimits(req.limits)
  );

  const reasons: ScoredEntityMeta[] = [];
  const excludedCounts: Record<string, number> = {};

  const wants = (section: string) =>
    profile.required.includes(section as never) ||
    profile.optional.includes(section as never);

  let characters: DynamicContext["characters"] = [];
  let selectedIds = new Set<string>();
  if (wants("characters")) {
    const sel = selectCharacters(req, profile, limits);
    characters = sel.characters;
    selectedIds = sel.selectedIds;
    reasons.push(...sel.metas);
    excludedCounts.characters = sel.excluded;
  } else {
    excludedCounts.characters = req.memory.characters.length;
  }

  let relationships: DynamicContext["relationships"] = [];
  if (wants("relationships")) {
    const sel = selectRelationships(req, selectedIds, limits);
    relationships = sel.relationships;
    reasons.push(...sel.metas);
    excludedCounts.relationships = sel.excluded;
  } else {
    excludedCounts.relationships = req.memory.relationships.length;
  }

  let locations: DynamicContext["locations"] = [];
  if (wants("locations")) {
    const sel = selectLocations(req, limits);
    locations = sel.locations;
    reasons.push(...sel.metas);
    excludedCounts.locations = sel.excluded;
  }

  let events: DynamicContext["events"] = [];
  if (wants("events")) {
    const sel = selectEvents(req, selectedIds, limits);
    events = sel.events;
    reasons.push(...sel.metas);
    excludedCounts.events = sel.excluded;
  }

  let openThreads: DynamicContext["openThreads"] = [];
  if (wants("openThreads")) {
    const sel = selectThreads(req, selectedIds, limits);
    openThreads = sel.openThreads;
    reasons.push(...sel.metas);
    excludedCounts.openThreads = sel.excluded;
  }

  let writingRules: DynamicContext["writingRules"] = [];
  if (wants("writingRules") || wants("preferences")) {
    const sel = selectWritingRules(req, profile, limits);
    writingRules = wants("writingRules") ? sel.writingRules : [];
    reasons.push(...sel.metas);
    excludedCounts.writingRules = sel.excluded;
  }

  let secrets: DynamicContext["secrets"] = [];
  let knowledge: DynamicContext["knowledge"] = {
    authorKnowledge: [],
    characterKnowledge: {},
  };
  if (wants("secrets") || wants("knowledge")) {
    const sel = selectSecrets(req, selectedIds, profile, limits);
    secrets = wants("secrets") ? sel.secrets : [];
    knowledge = sel.knowledge;
    excludedCounts.secrets = sel.excluded;
  }

  let promises: DynamicContext["promises"] = [];
  if (wants("promises")) {
    const sel = selectPromises(req, selectedIds, limits);
    promises = sel.promises;
    excludedCounts.promises = sel.excluded;
  }

  const preferences = wants("preferences")
    ? selectPreferences(req, profile)
    : {};

  const continuity = wants("continuity")
    ? {
        lastScene: req.memory.continuity.lastScene,
        lastEpisodeNumber: req.memory.continuity.lastEpisodeNumber,
        currentLocationId: req.memory.continuity.currentLocationId,
        activeCharacterIds: req.memory.continuity.activeCharacterIds,
        currentConflict: req.memory.continuity.currentConflict,
        currentMood: req.memory.continuity.currentMood,
        generationBlocked: Boolean(req.conversationFlow?.generationBlocked),
      }
    : {};

  const recentConversation = selectConversation(req, profile, limits);

  const draftSel = selectLatestDraft(req.memory, profile, limits);

  const story = wants("story")
    ? {
        title: req.memory.story.title,
        concept: req.memory.story.concept,
        genre: req.memory.story.genre,
        tone: req.memory.story.tone,
        themes: req.memory.story.themes,
        setting:
          locations[0]?.name ||
          req.memory.story.setting ||
          null,
      }
    : {
        title: null,
        concept: null,
        genre: [] as string[],
        tone: [] as string[],
        themes: [] as string[],
        setting: null,
      };

  const timeline = wants("timeline")
    ? req.memory.timeline
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .slice(0, 6)
        .map((t) => ({
          id: t.id,
          label: t.label,
          sequence: t.sequence,
          relativeTime: t.relativeTime,
        }))
    : [];

  const worldRules = wants("worldRules")
    ? req.memory.worldRules.slice(0, 8).map((w) => ({
        id: w.id,
        rule: w.rule,
        category: w.category,
      }))
    : [];

  let instructionContract: string | null = null;
  if (
    isInstructionFidelityEnabled() &&
    (wants("instructionContract") ||
      req.operation.includes("write") ||
      req.operation.includes("episode") ||
      req.operation.includes("revise"))
  ) {
    try {
      const legacy = Object.assign(toLegacyStoryMemory(req.memory), {
        memoryVersion: 2,
        __memoryV2: req.memory,
      });
      const state = readFidelityState(legacy as never);
      const contract = buildStoryGenerationContract({
        facts: state.resolvedFacts,
        operation: req.operation,
        latestInstruction: req.userMessage,
      });
      instructionContract = serializeGenerationContract(contract);
    } catch {
      instructionContract = null;
    }
  }

  let ctx: DynamicContext = {
    contextVersion: 2,
    operation: req.operation,
    intent: String(req.intent),
    story,
    characters,
    relationships,
    locations,
    objects: [],
    events,
    timeline,
    openThreads,
    secrets,
    promises,
    worldRules,
    writingRules,
    preferences,
    continuity,
    recentConversation,
    latestDraft: draftSel.latestDraft,
    recentSummary:
      profile.includeRecentSummary && wants("recentSummary")
        ? req.memory.recentSummary
        : profile.includeRecentSummary
          ? req.memory.recentSummary
          : null,
    knowledge,
    instructionContract,
    retrieval: {
      includedEntityIds: [
        ...characters.map((c) => c.id),
        ...relationships.map((r) => r.id),
        ...locations.map((l) => l.id),
        ...events.map((e) => e.id),
        ...openThreads.map((t) => t.id),
        ...writingRules.map((r) => r.id),
      ],
      excludedCounts,
      reasons,
      estimatedTokens: 0,
      sectionTokens: {},
      truncated: false,
      truncatedDraft: draftSel.truncated,
    },
  };

  const protectedRules = new Set(
    writingRules
      .filter(
        (r) =>
          r.priority === "critical" ||
          r.priority === "high" ||
          r.priority === "important"
      )
      .map((r) => r.id)
  );

  const est = estimateContextTokens(ctx);
  ctx.retrieval.estimatedTokens = est.total;
  ctx.retrieval.sectionTokens = est.sections;

  if (est.total > limits.maxTotalEstimatedTokens) {
    ctx = pruneToBudget(ctx, limits.maxTotalEstimatedTokens, protectedRules);
  }

  const parsed = dynamicContextSchema.safeParse(ctx);
  return parsed.success ? parsed.data : ctx;
}

export function buildContextRequestFromPlan(params: {
  intent: string;
  operation: string;
  userMessage: string;
  memory: ContextRequest["memory"];
  recentMessages: ContextRequest["recentMessages"];
  conversationFlow?: ContextRequest["conversationFlow"];
  entities?: ContextRequest["entities"];
  conversationId?: string;
  storyId?: string | null;
  limits?: ContextRequest["limits"];
}): ContextRequest {
  return {
    intent: params.intent,
    operation: params.operation,
    userMessage: params.userMessage,
    entities: params.entities || emptyEntities(),
    conversationFlow: params.conversationFlow,
    memory: params.memory,
    recentMessages: params.recentMessages,
    conversationId: params.conversationId,
    storyId: params.storyId,
    limits: params.limits,
  };
}
