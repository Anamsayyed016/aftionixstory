/**
 * Upgrade legacy StoryMemory / Conversation.state blobs → Memory v2.
 */

import { emptyStoryMemoryV2, nowIso } from "@/lib/story-memory/v2/defaults";
import {
  dedupeStrings,
  normalizeKey,
  normalizeName,
  normalizeRuleText,
  stableId,
} from "@/lib/story-memory/v2/normalize";
import {
  storyMemoryV2Schema,
  type CharacterV2,
  type RelationshipV2,
  type StoryMemoryV2,
  type WritingRuleV2,
} from "@/lib/story-memory/v2/schema";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function asStringList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return dedupeStrings(v.map((x) => String(x ?? "").trim()).filter(Boolean));
  }
  const t = String(v).trim();
  return t ? [t] : [];
}

function mapStatus(status: unknown): StoryMemoryV2["story"]["status"] {
  const s = String(status || "").toLowerCase();
  if (s === "created") return "created";
  if (s === "ready" || s === "ready_to_write") return "ready";
  if (s === "writing") return "writing";
  if (s === "shaping") return "shaping";
  if (s === "exploring") return "exploring";
  return "brainstorming";
}

function upgradeCharacter(raw: unknown, warnings: string[]): CharacterV2 | null {
  const r = asRecord(raw);
  if (!r) {
    warnings.push("skipped_malformed_character");
    return null;
  }
  const name = asString(r.name);
  if (!name) {
    warnings.push("skipped_character_without_name");
    return null;
  }
  const id =
    asString(r.id) ||
    asString(r.tempId) ||
    stableId("char", name);
  const now = nowIso();
  return {
    id,
    name,
    aliases: asStringList(r.aliases),
    role: asString(r.role),
    gender: asString(r.gender),
    age: r.age == null ? null : (r.age as string | number),
    occupation: asString(r.occupation),
    personalityTraits: asStringList(r.personalityTraits ?? r.personality),
    appearance: asStringList(r.appearance),
    goals: asStringList(r.goals),
    fears: asStringList(r.fears),
    strengths: asStringList(r.strengths),
    weaknesses: asStringList(r.weaknesses),
    backstory: asString(r.backstory ?? r.background),
    currentState: asString(r.currentState),
    status: "active",
    notes: asStringList(r.notes),
    avoid: asStringList(r.avoid),
    createdAt: asString(r.createdAt) || now,
    updatedAt: asString(r.updatedAt) || now,
  } as CharacterV2;
}

function upgradeRelationship(
  raw: unknown,
  characters: CharacterV2[],
  warnings: string[]
): RelationshipV2 | null {
  const r = asRecord(raw);
  if (!r) {
    warnings.push("skipped_malformed_relationship");
    return null;
  }

  const findId = (nameOrId: string | null): string | null => {
    if (!nameOrId) return null;
    const byId = characters.find((c) => c.id === nameOrId);
    if (byId) return byId.id;
    const byName = characters.find(
      (c) => normalizeName(c.name) === normalizeName(nameOrId)
    );
    return byName?.id ?? null;
  };

  let fromId = asString(r.fromCharacterId);
  let toId = asString(r.toCharacterId);
  const fromName = asString(r.from);
  const toName = asString(r.to);

  if (!fromId && fromName) {
    fromId = findId(fromName);
    if (!fromId) {
      // Create stub character for dangling legacy relationship
      const stub: CharacterV2 = {
        id: stableId("char", fromName),
        name: fromName,
        aliases: [],
        role: null,
        gender: null,
        age: null,
        occupation: null,
        personalityTraits: [],
        appearance: [],
        goals: [],
        fears: [],
        strengths: [],
        weaknesses: [],
        backstory: null,
        currentState: null,
        status: "active",
        notes: [],
        avoid: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      characters.push(stub);
      fromId = stub.id;
    }
  }
  if (!toId && toName) {
    toId = findId(toName);
    if (!toId) {
      const stub: CharacterV2 = {
        id: stableId("char", toName),
        name: toName,
        aliases: [],
        role: null,
        gender: null,
        age: null,
        occupation: null,
        personalityTraits: [],
        appearance: [],
        goals: [],
        fears: [],
        strengths: [],
        weaknesses: [],
        backstory: null,
        currentState: null,
        status: "active",
        notes: [],
        avoid: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      characters.push(stub);
      toId = stub.id;
    }
  }

  const type = asString(r.type);
  if (!fromId || !toId || !type) {
    warnings.push("skipped_malformed_relationship");
    return null;
  }

  const id =
    asString(r.id) ||
    stableId("rel", `${fromId}_${toId}_${normalizeKey(type)}`);

  const notes = asStringList(r.notes);
  return {
    id,
    fromCharacterId: fromId,
    toCharacterId: toId,
    type,
    label: asString(r.label),
    status: (asString(r.status) as RelationshipV2["status"]) || "developing",
    mutual: Boolean(r.mutual),
    history: asStringList(r.history),
    conflicts: asStringList(r.conflicts),
    secrets: asStringList(r.secrets),
    notes,
    supersededById: asString(r.supersededById),
    correctedFromId: asString(r.correctedFromId),
    updatedAt: asString(r.updatedAt) || nowIso(),
  };
}

function upgradeWritingRule(raw: unknown, warnings: string[]): WritingRuleV2 | null {
  const r = asRecord(raw);
  if (!r) {
    warnings.push("skipped_malformed_writing_rule");
    return null;
  }
  const rule = asString(r.rule);
  if (!rule) return null;
  const priorityRaw = asString(r.priority) || "normal";
  const priority =
    priorityRaw === "critical" || priorityRaw === "important" || priorityRaw === "high"
      ? priorityRaw
      : priorityRaw === "low"
        ? "low"
        : "normal";
  const now = nowIso();
  return {
    id: asString(r.id) || stableId("wrule", normalizeRuleText(rule)),
    rule,
    category: asString(r.category),
    priority: priority as WritingRuleV2["priority"],
    active: r.active === false ? false : true,
    source: (asString(r.source) as WritingRuleV2["source"]) || "user",
    createdAt: asString(r.createdAt) || now,
    updatedAt: asString(r.updatedAt) || now,
  };
}

/**
 * Upgrade any Conversation.state / legacy StoryMemory blob to Memory v2.
 * Idempotent: upgrading v2 again yields an equivalent structure.
 */
export function upgradeStoryMemory(input: unknown): StoryMemoryV2 {
  const warnings: string[] = [];
  const root = asRecord(input) ?? {};

  // Already v2 (or close)
  if (root.memoryVersion === 2 || root.memoryVersion === "2") {
    const parsed = storyMemoryV2Schema.safeParse({
      ...root,
      memoryVersion: 2,
    });
    if (parsed.success) {
      // Ensure characters have IDs
      const characters = parsed.data.characters.map((c) =>
        c.id ? c : { ...c, id: stableId("char", c.name) }
      );
      return {
        ...parsed.data,
        characters,
        metadata: {
          ...parsed.data.metadata,
          warnings: [
            ...parsed.data.metadata.warnings,
            ...warnings,
          ],
        },
      };
    }
  }

  const legacyCore =
    asRecord(root.storyMemory) ||
    asRecord(root.story) ||
    {};

  const characters: CharacterV2[] = [];
  const seenChar = new Set<string>();
  const rawChars = Array.isArray(root.characters) ? root.characters : [];
  for (const raw of rawChars) {
    const c = upgradeCharacter(raw, warnings);
    if (!c) continue;
    const key = normalizeName(c.name);
    if (seenChar.has(key)) {
      // Merge aliases into existing
      const existing = characters.find((x) => normalizeName(x.name) === key)!;
      existing.aliases = dedupeStrings([...existing.aliases, ...c.aliases, c.name]);
      existing.personalityTraits = dedupeStrings([
        ...existing.personalityTraits,
        ...c.personalityTraits,
      ]);
      continue;
    }
    seenChar.add(key);
    characters.push(c);
  }

  const relationships: RelationshipV2[] = [];
  const seenRel = new Set<string>();
  const rawRels = Array.isArray(root.relationships) ? root.relationships : [];
  for (const raw of rawRels) {
    const rel = upgradeRelationship(raw, characters, warnings);
    if (!rel) continue;
    const key = `${rel.fromCharacterId}::${rel.toCharacterId}::${normalizeKey(rel.type)}`;
    const rev = `${rel.toCharacterId}::${rel.fromCharacterId}::${normalizeKey(rel.type)}`;
    if (seenRel.has(key) || (rel.mutual && seenRel.has(rev))) continue;
    seenRel.add(key);
    relationships.push(rel);
  }

  const writingRules: WritingRuleV2[] = [];
  const seenRules = new Set<string>();
  const rawRules = Array.isArray(root.writingRules) ? root.writingRules : [];
  for (const raw of rawRules) {
    const rule = upgradeWritingRule(raw, warnings);
    if (!rule) continue;
    const key = normalizeRuleText(rule.rule);
    if (seenRules.has(key)) continue;
    seenRules.add(key);
    writingRules.push(rule);
  }

  const prefs = asRecord(root.userPreferences) || {};
  const continuity = asRecord(root.continuity) || {};
  const metadata = asRecord(root.metadata) || {};

  // Preserve unknown top-level legacy keys into metadata.legacy
  const known = new Set([
    "memoryVersion",
    "storyMemory",
    "story",
    "characters",
    "relationships",
    "locations",
    "objects",
    "events",
    "timeline",
    "openThreads",
    "secrets",
    "promises",
    "worldRules",
    "writingRules",
    "userPreferences",
    "continuity",
    "latestDraft",
    "recentSummary",
    "metadata",
    "updatedAt",
    "conversationFlow",
    "storyId",
    "agentVersion",
    "brainVersion",
    "draftForm",
    "extraction",
  ]);
  const legacyExtras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(root)) {
    if (!known.has(k)) legacyExtras[k] = v;
  }

  const draft = root.latestDraft ?? null;

  const upgraded: StoryMemoryV2 = emptyStoryMemoryV2();
  upgraded.story = {
    title: asString(legacyCore.title),
    concept: asString(legacyCore.concept),
    genre: asStringList(legacyCore.genre),
    tone: asStringList(legacyCore.tone),
    themes: asStringList(legacyCore.themes),
    setting: asString(legacyCore.setting),
    plot: asString(legacyCore.plot),
    status: mapStatus(legacyCore.storyStatus ?? legacyCore.status),
    language: asString(legacyCore.language),
    pov: asString(legacyCore.pov),
    pacing: asString(legacyCore.pacing),
    writingStyle: asString(legacyCore.writingStyle),
  };
  upgraded.characters = characters;
  upgraded.relationships = relationships;
  upgraded.writingRules = writingRules;
  upgraded.locations = Array.isArray(root.locations) ? (root.locations as StoryMemoryV2["locations"]) : [];
  upgraded.objects = Array.isArray(root.objects) ? (root.objects as StoryMemoryV2["objects"]) : [];
  upgraded.events = Array.isArray(root.events) ? (root.events as StoryMemoryV2["events"]) : [];
  upgraded.timeline = Array.isArray(root.timeline) ? (root.timeline as StoryMemoryV2["timeline"]) : [];
  upgraded.openThreads = Array.isArray(root.openThreads)
    ? (root.openThreads as StoryMemoryV2["openThreads"])
    : [];
  upgraded.secrets = Array.isArray(root.secrets) ? (root.secrets as StoryMemoryV2["secrets"]) : [];
  upgraded.promises = Array.isArray(root.promises) ? (root.promises as StoryMemoryV2["promises"]) : [];
  upgraded.worldRules = Array.isArray(root.worldRules)
    ? (root.worldRules as StoryMemoryV2["worldRules"])
    : [];

  upgraded.userPreferences = {
    ...upgraded.userPreferences,
    ...prefs,
    language:
      asString(prefs.language) ||
      asString(prefs.dialogueLanguage) ||
      asString(prefs.narrationLanguage),
    responseLanguage:
      asString(prefs.responseLanguage) || asString(prefs.dialogueLanguage),
    storyLanguage:
      asString(prefs.storyLanguage) || asString(prefs.narrationLanguage),
    emojiLevel: asString(prefs.emojiLevel) || asString(prefs.emojiStyle),
    dialogueStyle: asString(prefs.dialogueStyle),
    narrationStyle: asString(prefs.narrationStyle),
    pacing: asString(prefs.pacing) || asString(prefs.pacingHint),
    pov: asString(prefs.pov),
    tone: asStringList(prefs.tone),
    preferredGenres: asStringList(prefs.preferredGenres),
    avoid: asStringList(prefs.avoid),
    custom: asRecord(prefs.custom) || {},
    dialogueLanguage: asString(prefs.dialogueLanguage),
    narrationLanguage: asString(prefs.narrationLanguage),
    mirrorUserLanguage: prefs.mirrorUserLanguage !== false,
    uppercaseForLoudDialogue: Boolean(prefs.uppercaseForLoudDialogue),
    slowBurn: Boolean(prefs.slowBurn),
    doNotStartYet: Boolean(prefs.doNotStartYet),
    avoidFormalHindi: prefs.avoidFormalHindi !== false,
    preferShortDialogues: Boolean(prefs.preferShortDialogues),
    emojiStyle: asString(prefs.emojiStyle),
    formality: asString(prefs.formality),
    format: asString(prefs.format),
    episodeLength: asString(prefs.episodeLength),
    scriptPreference: asString(prefs.scriptPreference),
    pacingHint: asString(prefs.pacingHint),
  };

  upgraded.continuity = {
    ...upgraded.continuity,
    ...continuity,
  };

  upgraded.latestDraft =
    draft && typeof draft === "object"
      ? (draft as StoryMemoryV2["latestDraft"])
      : null;
  upgraded.recentSummary = asString(root.recentSummary);
  upgraded.updatedAt = asString(root.updatedAt) || nowIso();
  upgraded.metadata = {
    memoryConflicts: Array.isArray(metadata.memoryConflicts)
      ? (metadata.memoryConflicts as StoryMemoryV2["metadata"]["memoryConflicts"])
      : [],
    correctionHistory: Array.isArray(metadata.correctionHistory)
      ? (metadata.correctionHistory as StoryMemoryV2["metadata"]["correctionHistory"])
      : [],
    warnings,
    revision:
      typeof metadata.revision === "number" && Number.isFinite(metadata.revision)
        ? metadata.revision
        : 0,
    ...(Object.keys(legacyExtras).length
      ? { legacy: legacyExtras }
      : {}),
  };

  const parsed = storyMemoryV2Schema.safeParse(upgraded);
  return parsed.success ? parsed.data : upgraded;
}
