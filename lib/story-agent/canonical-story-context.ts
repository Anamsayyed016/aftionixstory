import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import { isValidCanonicalEntityName } from "@/lib/story-agent/entity-guards";
import { sanitizeStoryMemoryCanon } from "@/lib/story-agent/sanitize-memory";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { readFidelityState } from "@/lib/story-fidelity/resolve-facts";

export type CanonicalStoryContext = {
  conversationId: string;
  storyId?: string;
  rawSynopsis: string;
  normalizedSynopsis: string;
  language: string;
  latestInstruction: string;
  characters: Array<{
    name: string;
    role?: string;
    traits?: string[];
    required?: boolean;
  }>;
  relationships: Array<{ from: string; to: string; type: string }>;
  locations: string[];
  timelineFacts: string[];
  plotFacts: string[];
  lockedFacts: string[];
};

type ChatMessage = { role: string; content: string };

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function sentenceFacts(text: string): string[] {
  return unique(
    text
      .split(/(?<=[.!?])\s+|\n+/)
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length >= 12 &&
          /\b(nikah|marri|slap|thappad|pregnan|refus|business\s+partner|leave|left|return|romance|love|secret|conflict|years?\s+later|paris)\b/i.test(
            part
          )
      )
  );
}

/**
 * Capitalization is only accepted when the name has a real person signal:
 * title, a multi-word proper name, relationship/action context, or repetition.
 */
export function extractCanonicalNamesFromSynopsis(text: string): string[] {
  const counts = new Map<string, { name: string; count: number; strong: boolean }>();
  const add = (name: string, strong = false) => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!isValidCanonicalEntityName(trimmed)) return;
    const key = trimmed.toLowerCase();
    const current = counts.get(key) ?? { name: trimmed, count: 0, strong: false };
    current.count += 1;
    current.strong ||= strong;
    counts.set(key, current);
  };

  const titled = /\b(?:Dr|Mr|Mrs|Miss|Ms|Sir|Begum)\.?(?:\s+)([A-Z][A-Za-z'.-]*(?:\s+[A-Z][A-Za-z'.-]*)?)/g;
  let match: RegExpExecArray | null;
  while ((match = titled.exec(text)) !== null) add(match[0], true);

  const fullName = /\b([A-Z][A-Za-z'.-]*\s+[A-Z][A-Za-z'.-]*)\b/g;
  while ((match = fullName.exec(text)) !== null) add(match[1], true);

  const single = /\b([A-Z][a-z]{1,30})\b/g;
  while ((match = single.exec(text)) !== null) {
    const before = text.slice(Math.max(0, match.index - 40), match.index);
    const after = text.slice(match.index + match[0].length, match.index + 48);
    const personContext =
      /\b(?:with|and|aur|ka|ki|ko|ne|is|was|said|calls?|asked|told|slapped|refused|left|returns?)\s*$/i.test(
        before
      ) ||
      /^\s+(?:and|aur|is|was|said|calls?|asked|told|slapped|refused|left|returns?|ki|ka|ko)\b/i.test(
        after
      );
    add(match[1], personContext);
  }

  return Array.from(counts.values())
    .filter((entry) => entry.strong || entry.count >= 2)
    .map((entry) => entry.name);
}

export function isSubstantiveStoryMessage(message: string): boolean {
  const text = message.trim();
  if (text.length < 80) return false;
  const hasStorySignal =
    /\b(nikah|marri|relationship|partner|friend|father|mother|daughter|son|love|romance|conflict|secret|refus|slap|pregnan|paris|story|character|backstory|synopsis|teaser|prologue)\b/i.test(
      text
    );
  return hasStorySignal && extractCanonicalNamesFromSynopsis(text).length >= 1;
}

/** Short edits inherit active canon; they are never a request for a new world. */
export function isStoryContinuationModifier(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 280) return false;
  if (/\b(?:do not start|don't start|start mat|new story|switch topic|unrelated)\b/i.test(text)) {
    return false;
  }
  return /\b(?:hinglish|continue|rewrite|replace|rename|change|fix|modify|improve|add\s+(?:romance|comedy|humou?r)|more\s+(?:emotional|romantic|funny)|slow\s*burn|uppercase\s+dialogues?|not\s+partners?)\b/i.test(
    text
  );
}

function normalized(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function validStoredContext(value: unknown): CanonicalStoryContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CanonicalStoryContext>;
  if (typeof candidate.conversationId !== "string") return null;
  if (typeof candidate.rawSynopsis !== "string" || !candidate.rawSynopsis.trim()) return null;
  if (!Array.isArray(candidate.characters)) return null;
  return {
    conversationId: candidate.conversationId,
    ...(typeof candidate.storyId === "string" ? { storyId: candidate.storyId } : {}),
    rawSynopsis: candidate.rawSynopsis,
    normalizedSynopsis: candidate.normalizedSynopsis || normalized(candidate.rawSynopsis),
    language: candidate.language || "auto",
    latestInstruction: candidate.latestInstruction || "",
    characters: candidate.characters
      .filter((character) => character && isValidCanonicalEntityName(character.name))
      .map((character) => ({
        name: character.name.trim(),
        ...(character.role ? { role: character.role } : {}),
        ...(Array.isArray(character.traits) ? { traits: character.traits } : {}),
        ...(character.required ? { required: true } : {}),
      })),
    relationships: Array.isArray(candidate.relationships) ? candidate.relationships : [],
    locations: Array.isArray(candidate.locations) ? candidate.locations : [],
    timelineFacts: Array.isArray(candidate.timelineFacts) ? candidate.timelineFacts : [],
    plotFacts: Array.isArray(candidate.plotFacts) ? candidate.plotFacts : [],
    lockedFacts: Array.isArray(candidate.lockedFacts) ? candidate.lockedFacts : [],
  };
}

export function readCanonicalStoryContext(state: unknown): CanonicalStoryContext | null {
  if (!state || typeof state !== "object") return null;
  return validStoredContext(
    (state as Record<string, unknown>).canonicalStoryContext
  );
}

export function buildCanonicalStoryContext(params: {
  conversationId: string;
  storyId?: string | null;
  memory: StoryMemory;
  recentMessages: ChatMessage[];
  latestInstruction: string;
  previous?: CanonicalStoryContext | null;
}): CanonicalStoryContext {
  const { memory } = sanitizeStoryMemoryCanon(params.memory);
  const v2 = getMemoryV2(memory);
  const earliestSynopsis = params.recentMessages.find(
    (message) => message.role === "user" && isSubstantiveStoryMessage(message.content)
  )?.content;
  const rawSynopsis =
    params.previous?.rawSynopsis ||
    earliestSynopsis ||
    memory.storyMemory.concept ||
    memory.storyMemory.plot ||
    "";

  // If legacy memory still carried pseudo-entities, rebuild cast from synopsis.
  const previousCharacters = (params.previous?.characters ?? [])
    .map((character) => character.name)
    .filter(isValidCanonicalEntityName);

  const namesById = new Map(v2.characters.map((character) => [character.id, character.name]));
  const canonicalCharacters = unique([
    ...previousCharacters,
    ...v2.characters.map((character) => character.name),
    ...memory.characters.map((character) => character.name),
    ...extractCanonicalNamesFromSynopsis(rawSynopsis),
  ])
    .filter(isValidCanonicalEntityName)
    .map((name, index) => {
      const stored = v2.characters.find(
        (character) => character.name.toLowerCase() === name.toLowerCase()
      );
      const legacy = memory.characters.find(
        (character) => character.name.toLowerCase() === name.toLowerCase()
      );
      return {
        name: stored?.name ?? legacy?.name ?? name,
        ...(stored?.role || legacy?.role
          ? { role: stored?.role ?? legacy?.role ?? undefined }
          : {}),
        ...(stored?.personalityTraits?.length || legacy?.personality?.length
          ? { traits: stored?.personalityTraits ?? legacy?.personality ?? [] }
          : {}),
        ...(index < 2 ? { required: true } : {}),
      };
    });

  const relationships = [
    ...(params.previous?.relationships ?? []),
    ...v2.relationships.map((relationship) => ({
      from: namesById.get(relationship.fromCharacterId) ?? relationship.fromCharacterId,
      to: namesById.get(relationship.toCharacterId) ?? relationship.toCharacterId,
      type: relationship.type,
    })),
    ...memory.relationships.map((relationship) => ({
      from: relationship.from,
      to: relationship.to,
      type: relationship.type,
    })),
  ].filter(
    (relationship) =>
      isValidCanonicalEntityName(relationship.from) &&
      isValidCanonicalEntityName(relationship.to) &&
      Boolean(relationship.type?.trim())
  );

  const locations = unique([
    ...(params.previous?.locations ?? []),
    ...v2.locations.map((location) => location.name),
    memory.storyMemory.setting,
    v2.story.setting,
    ...Array.from(rawSynopsis.matchAll(/\b(?:in|from|to|leaves?|left|return(?:ed|s)?\s+to)\s+([A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*)?)/g)).map(
      (match) => match[1]
    ),
  ]).filter((location) => isValidCanonicalEntityName(location));

  const plotFacts = unique([
    ...(params.previous?.plotFacts ?? []),
    memory.storyMemory.concept,
    memory.storyMemory.plot,
    v2.story.concept,
    v2.story.plot,
    ...v2.events.flatMap((event) => [event.title, event.description]),
    ...sentenceFacts(rawSynopsis),
  ]);
  const timelineFacts = unique([
    ...(params.previous?.timelineFacts ?? []),
    ...v2.timeline.flatMap((item) => [item.label, item.relativeTime, item.absoluteDate, ...item.notes]),
    ...v2.events.flatMap((event) => [event.title, event.description]),
    ...sentenceFacts(rawSynopsis).filter((fact) => /years?\s+later|before|after|then|later|left|return/i.test(fact)),
  ]);

  const fidelity = readFidelityState(memory).resolvedFacts;
  const lockedFacts = unique([
    ...(params.previous?.lockedFacts ?? []),
    ...(fidelity.metadata.lockedFields ?? []).map((field) => `Locked: ${field}`),
    fidelity.characters.mainMaleLead,
    fidelity.characters.mainFemaleLead,
    fidelity.setting.primarySetting,
    fidelity.language.storyLanguage,
    ...(isStoryContinuationModifier(params.latestInstruction)
      ? [`Latest canonical update: ${params.latestInstruction.trim()}`]
      : []),
  ]);
  const requestedLanguage = /\bhinglish\b/i.test(params.latestInstruction)
    ? "Hinglish"
    : /\b(?:hindi|urdu|english)\b/i.exec(params.latestInstruction)?.[0];
  const language =
    requestedLanguage ||
    memory.userPreferences.dialogueLanguage ||
    memory.userPreferences.narrationLanguage ||
    memory.storyMemory.language ||
    v2.userPreferences.storyLanguage ||
    v2.story.language ||
    params.previous?.language ||
    "auto";

  return {
    conversationId: params.conversationId,
    ...(params.storyId ? { storyId: params.storyId } : {}),
    rawSynopsis: rawSynopsis.trim(),
    normalizedSynopsis: normalized(rawSynopsis),
    language,
    latestInstruction: params.latestInstruction.trim(),
    characters: canonicalCharacters,
    relationships: relationships.filter(
      (relationship, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.from.toLowerCase() === relationship.from.toLowerCase() &&
            candidate.to.toLowerCase() === relationship.to.toLowerCase() &&
            candidate.type.toLowerCase() === relationship.type.toLowerCase()
        ) === index
    ),
    locations,
    timelineFacts,
    plotFacts,
    lockedFacts,
  };
}

export function serializeCanonicalStoryContext(context: CanonicalStoryContext): string {
  const relationships = context.relationships
    .map((relationship) => `${relationship.from} -> ${relationship.to}: ${relationship.type}`)
    .join("; ");
  return [
    "CANONICAL STORY CONTEXT (authoritative; do not replace this universe):",
    `RAW SYNOPSIS:\n${context.rawSynopsis || "Not yet supplied."}`,
    `NORMALIZED SYNOPSIS: ${context.normalizedSynopsis || "Not yet supplied."}`,
    `CORE CHARACTERS: ${context.characters
      .map((character) => `${character.name}${character.role ? ` (${character.role})` : ""}`)
      .join(", ") || "Not yet resolved."}`,
    `RELATIONSHIPS: ${relationships || "Not yet resolved."}`,
    `LOCATIONS: ${context.locations.join(", ") || "Not yet resolved."}`,
    `TIMELINE FACTS: ${context.timelineFacts.join(" | ") || "Not yet resolved."}`,
    `PLOT FACTS: ${context.plotFacts.join(" | ") || "Not yet resolved."}`,
    `LOCKED FACTS: ${context.lockedFacts.join(" | ") || "None."}`,
    `LANGUAGE: ${context.language}`,
    `LATEST INSTRUCTION: ${context.latestInstruction}`,
    "Continue this exact story. Never promote style words, correction text, UI labels, or headings into character names.",
  ].join("\n\n");
}

export function summarizeCanonicalStoryContext(context: CanonicalStoryContext) {
  return {
    hasRawSynopsis: Boolean(context.rawSynopsis),
    characterNames: context.characters.map((character) => character.name),
    relationshipCount: context.relationships.length,
    locations: context.locations,
    plotFactCount: context.plotFacts.length,
    timelineFactCount: context.timelineFacts.length,
    lockedFactCount: context.lockedFacts.length,
    language: context.language,
  };
}
