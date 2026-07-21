import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import { resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import { isValidCanonicalEntityName } from "@/lib/story-agent/entity-guards";
import {
  extractCanonicalNamesFromSynopsis,
} from "@/lib/story-agent/canonical-story-context";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { readFidelityState } from "@/lib/story-fidelity/resolve-facts";

export type RetrievalMode =
  | "OPENING"
  | "CONTINUE"
  | "REWRITE"
  | "STYLE_CHANGE"
  | "SCENE_GENERATION"
  | "EPISODE_GENERATION"
  | "DIALOGUE_GENERATION"
  | "CONTINUITY_CHECK";

export type RetrievedStoryContext = {
  rawSynopsis: string;
  normalizedSynopsis: string;
  language: string;
  latestInstruction: string;
  requiredCharacters: Array<{
    name: string;
    role?: string;
    traits?: string[];
    currentState?: string;
  }>;
  relevantRelationships: Array<{
    from: string;
    to: string;
    type: string;
    currentStatus?: string;
  }>;
  relevantLocations: string[];
  timelineFacts: string[];
  relevantPlotFacts: string[];
  lockedFacts: string[];
  unresolvedThreads: string[];
  previousSceneSummary?: string;
  recentDialogueContext?: string;
  currentEpisodeGoal?: string;
};

export type SceneGenerationContract = {
  mode: string;
  language: string;
  requiredCharacters: string[];
  allowedNewCharacters: number;
  location?: string;
  timelinePosition?: string;
  activeConflict: string[];
  relationshipsToPreserve: string[];
  lockedFacts: string[];
  previousSceneHook?: string;
  requestedTone?: string;
};

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function selectRelevantCharacters(
  memory: StoryMemory,
  userMessage: string,
  requested: string[],
  mode: RetrievalMode
): Array<{ name: string; role?: string; traits?: string[]; currentState?: string }> {
  const names = requested.length > 0 ? requested : memory.characters.map((c) => c.name);
  const selected = names
    .map((name) => memory.characters.find((c) => c.name.toLowerCase() === name.toLowerCase()))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  if (mode === "STYLE_CHANGE") {
    return memory.characters.slice(0, 5).map((character) => ({
      name: character.name,
      role: character.role,
      traits: character.personality ?? [],
      currentState: character.notes?.[0],
    }));
  }

  const leadCandidates = memory.characters
    .filter((character) => /lead|protagonist|hero|heroine/i.test(character.role ?? ""))
    .slice(0, 4);

  const preferred =
    selected.length > 0
      ? selected
      : leadCandidates.length > 0
        ? leadCandidates
        : memory.characters.slice(0, 5);

  if (preferred.length === 0 && names.length > 0) {
    // Synopsis / soft-cast names are valid even before memory rows exist.
    return names
      .filter((name) => isValidCanonicalEntityName(name))
      .slice(0, 4)
      .map((name) => ({ name }));
  }

  return preferred.slice(0, 5).map((character) => ({
    name: character.name,
    role: character.role,
    traits: character.personality ?? [],
    currentState: character.notes?.[0],
  }));
}

function preserveRequestOrder(names: string[], userMessage: string): string[] {
  const lower = userMessage.toLowerCase();
  const found: string[] = [];
  for (const name of names) {
    if (!name.trim()) continue;
    if (lower.includes(name.toLowerCase()) && !found.includes(name)) {
      found.push(name);
    }
  }
  for (const name of names) {
    if (!found.includes(name) && isValidCanonicalEntityName(name)) {
      found.push(name);
    }
  }
  return found;
}

function mapPartialNamesToCanonical(
  requested: string[],
  memory: StoryMemory
): string[] {
  const resolved: string[] = [];
  for (const requestedName of requested) {
    const trimmed = requestedName.trim();
    if (!trimmed) continue;
    const canonical = memory.characters.find(
      (character) =>
        character.name.toLowerCase() === trimmed.toLowerCase() ||
        character.name.toLowerCase().includes(trimmed.toLowerCase()) ||
        trimmed.toLowerCase().includes(character.name.toLowerCase())
    )?.name;
    if (canonical && !resolved.some((name) => name.toLowerCase() === canonical.toLowerCase())) {
      resolved.push(canonical);
    } else if (!resolved.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
      resolved.push(trimmed);
    }
  }
  return resolved;
}

function pickRelevantRelationships(
  memory: StoryMemory,
  requestedNames: string[],
  mode: RetrievalMode
) {
  const nameSet = new Set(requestedNames.map((name) => name.toLowerCase()));
  const relationships = memory.relationships.filter(
    (relationship) =>
      nameSet.has(relationship.from.toLowerCase()) ||
      nameSet.has(relationship.to.toLowerCase())
  );

  const preferred = mode === "STYLE_CHANGE" ? memory.relationships : relationships;
  return preferred.slice(0, 6).map((relationship) => ({
    from: relationship.from,
    to: relationship.to,
    type: relationship.type,
    currentStatus: relationship.notes ?? relationship.type,
  }));
}

export function retrieveStoryContext(params: {
  memory: StoryMemory;
  userMessage: string;
  conversationId?: string;
  storyId?: string | null;
  recentMessages?: Array<{ role: string; content: string }>;
  mode?: RetrievalMode;
}): RetrievedStoryContext {
  const memory = params.memory;
  const v2 = getMemoryV2(memory);
  const resolved = resolveSceneRequest(params.userMessage, memory);
  const rawSynopsis =
    params.recentMessages?.find((message) => message.role === "user" && message.content.trim().length > 80)?.content ||
    memory.storyMemory.concept ||
    memory.storyMemory.plot ||
    "";
  const synopsisNames = extractCanonicalNamesFromSynopsis(rawSynopsis);
  const leadNames = unique(
    memory.characters
      .filter((character) => /lead|protagonist|hero|heroine/i.test(character.role ?? ""))
      .map((character) => character.name)
  );
  const fallbackCharacterNames = unique([
    ...leadNames,
    ...synopsisNames,
    ...memory.characters.map((character) => character.name),
  ]);
  const shouldUseFallbackCast =
    resolved.requestedCharacters.length === 0 ||
    resolved.requestedCharacters.every((character) => character.source === "memory_context");
  const namesFromRequest = preserveRequestOrder(
    mapPartialNamesToCanonical(
      shouldUseFallbackCast
        ? fallbackCharacterNames
        : resolved.characterNames.length > 0
          ? resolved.characterNames
          : synopsisNames.length > 0
            ? synopsisNames
            : memory.characters.map((c) => c.name),
      memory
    ),
    params.userMessage
  );
  const requestedNames = namesFromRequest.slice(0, 4);

  const normalizedSynopsis = normalize(rawSynopsis);
  const latestInstruction = params.userMessage.trim();

  const fidelity = readFidelityState(memory).resolvedFacts;
  const lockedFacts = unique([
    `Locked story premise: ${memory.storyMemory.concept || "Not yet supplied."}`,
    `Locked conflict: ${memory.storyMemory.plot || "Not yet supplied."}`,
    ...fidelity.metadata.lockedFields.map((field) => `Locked: ${field}`),
    fidelity.characters.mainMaleLead ? `Locked lead: ${fidelity.characters.mainMaleLead}` : undefined,
    fidelity.characters.mainFemaleLead ? `Locked lead: ${fidelity.characters.mainFemaleLead}` : undefined,
    fidelity.setting.primarySetting ? `Locked setting: ${fidelity.setting.primarySetting}` : undefined,
    fidelity.language.storyLanguage ? `Locked language: ${fidelity.language.storyLanguage}` : undefined,
  ]);
  const language = /\bhinglish\b/i.test(params.userMessage)
    ? "Hinglish"
    : memory.userPreferences.dialogueLanguage ||
      memory.userPreferences.narrationLanguage ||
      memory.storyMemory.language ||
      v2.userPreferences.storyLanguage ||
      "English";

  const requiredCharacters = selectRelevantCharacters(
    memory,
    params.userMessage,
    requestedNames,
    params.mode ?? "OPENING"
  );
  const relevantRelationships = pickRelevantRelationships(memory, requestedNames, params.mode ?? "OPENING");
  const locations = unique([
    memory.storyMemory.setting,
    v2.story.setting,
    v2.locations.find((location) => location.id === v2.continuity.currentLocationId)?.name,
    ...v2.locations.map((location) => location.name),
  ]).filter((name) => isValidCanonicalEntityName(name));

  const timelineFacts = unique([
    ...v2.timeline.slice(-6).flatMap((item) => [item.label, item.relativeTime, item.absoluteDate]),
    ...v2.events.slice(-6).flatMap((event) => [event.title, event.description]),
    `Current conflict: ${v2.continuity.currentConflict || "not yet resolved"}`,
    `Current location: ${v2.locations.find((location) => location.id === v2.continuity.currentLocationId)?.name || memory.storyMemory.setting || "not yet set"}`,
  ]);

  const relevantPlotFacts = unique([
    memory.storyMemory.plot,
    v2.story.plot,
    ...v2.events.slice(-6).map((event) => event.title),
    ...v2.openThreads.slice(0, 3).map((thread) => thread.title),
  ]);

  const unresolvedThreads = unique([
    ...v2.openThreads
      .filter((thread) => thread.status === "open" || thread.status === "paused")
      .map((thread) => thread.title),
    ...(v2.continuity.currentConflict ? [v2.continuity.currentConflict] : []),
    ...(memory.storyMemory.plot ? [memory.storyMemory.plot] : []),
  ]);

  const previousSceneSummary =
    params.mode === "CONTINUE" || params.mode === "REWRITE" || params.mode === "SCENE_GENERATION"
      ? memory.latestDraft?.content?.trim()
      : undefined;

  const recentDialogueContext = params.recentMessages
    ?.slice(-3)
    .map((message) => message.content)
    .join(" ")
    .trim();

  const currentEpisodeGoal =
    memory.latestDraft?.content?.trim() ||
    v2.continuity.currentConflict ||
    memory.storyMemory.plot ||
    undefined;

  return {
    rawSynopsis,
    normalizedSynopsis,
    language,
    latestInstruction,
    requiredCharacters,
    relevantRelationships,
    relevantLocations: locations,
    timelineFacts,
    relevantPlotFacts,
    lockedFacts,
    unresolvedThreads,
    previousSceneSummary,
    recentDialogueContext,
    currentEpisodeGoal,
  };
}

export function buildSceneGenerationContract(
  ctx: RetrievedStoryContext,
  userMessage: string
): SceneGenerationContract {
  const requiredCharacters = ctx.requiredCharacters.map((character) => character.name);
  const tone = /more emotional|emotional/i.test(userMessage)
    ? "emotional"
    : /hinglish|hindi|urdu/i.test(userMessage)
      ? "hinglish"
      : undefined;

  return {
    mode: /\bcontinue\b/i.test(userMessage)
      ? "CONTINUE"
      : /\brewrite\b|\bregenerate\b|\bfix\b/i.test(userMessage)
        ? "REWRITE"
        : "SCENE_GENERATION",
    language: ctx.language,
    requiredCharacters,
    allowedNewCharacters: 0,
    location: ctx.relevantLocations[0],
    timelinePosition: ctx.timelineFacts[0],
    activeConflict: ctx.unresolvedThreads.length > 0
      ? ctx.unresolvedThreads
      : ctx.relevantPlotFacts.slice(0, 3),
    relationshipsToPreserve: ctx.relevantRelationships.map((rel) => `${rel.from} -> ${rel.to}: ${rel.type}`),
    lockedFacts: ctx.lockedFacts,
    previousSceneHook: ctx.previousSceneSummary,
    requestedTone: tone,
  };
}

export function serializeRetrievedStoryContext(ctx: RetrievedStoryContext): string {
  return [
    "[ORIGINAL STORY SYNOPSIS]",
    ctx.rawSynopsis || ctx.normalizedSynopsis || "Not yet provided.",
    "",
    "[CANONICAL CHARACTERS]",
    ctx.requiredCharacters.map((character) => `${character.name}${character.role ? ` (${character.role})` : ""}${character.traits?.length ? ` — ${character.traits.join(", ")}` : ""}`).join("\n") || "None.",
    "",
    "[RELATIONSHIPS]",
    ctx.relevantRelationships.map((relationship) => `${relationship.from} -> ${relationship.to}: ${relationship.type}`).join("\n") || "None.",
    "",
    "[TIMELINE]",
    ctx.timelineFacts.join("\n") || "Not yet resolved.",
    "",
    "[LOCKED FACTS]",
    ctx.lockedFacts.join("\n") || "None.",
    "",
    "[PREVIOUS SCENE]",
    ctx.previousSceneSummary || ctx.recentDialogueContext || "No previous scene summary available.",
    "",
    "[CURRENT USER INSTRUCTION]",
    ctx.latestInstruction || "No explicit instruction.",
  ].join("\n");
}

export function serializeSceneGenerationContract(contract: SceneGenerationContract): string {
  return [
    "[SCENE CONTRACT]",
    `Mode: ${contract.mode}`,
    `Language: ${contract.language}`,
    `Required Characters: ${contract.requiredCharacters.join(", ") || "None"}`,
    `Allowed New Characters: ${contract.allowedNewCharacters}`,
    contract.location ? `Location: ${contract.location}` : "",
    contract.timelinePosition ? `Timeline Position: ${contract.timelinePosition}` : "",
    `Active Conflict: ${contract.activeConflict.join(" | ") || "None"}`,
    `Relationships to Preserve: ${contract.relationshipsToPreserve.join(" | ") || "None"}`,
    `Locked Facts: ${contract.lockedFacts.join(" | ") || "None"}`,
    contract.previousSceneHook ? `Previous Scene Hook: ${contract.previousSceneHook}` : "",
    contract.requestedTone ? `Requested Tone: ${contract.requestedTone}` : "",
    "",
    "[OUTPUT FORMAT]",
    "Return only the requested story prose. Do not introduce unrelated lead characters. Minor unnamed supporting characters are allowed only when necessary.",
  ]
    .filter(Boolean)
    .join("\n");
}
