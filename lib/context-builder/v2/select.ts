/**
 * Entity selectors for Dynamic Context v2.
 */

import type { OperationProfile } from "@/lib/context-builder/v2/profiles";
import type { ContextRequest } from "@/lib/context-builder/v2/request";
import type { ContextLimits, ScoredEntityMeta } from "@/lib/context-builder/v2/schema";
import {
  findCharacterIdsInMessage,
  nameLookup,
  scoreCharacter,
  scoreEvent,
  scoreLocation,
  scoreRelationship,
  scoreThread,
  scoreWritingRule,
} from "@/lib/context-builder/v2/scoring";
import { normalizeRuleText } from "@/lib/story-memory/v2/normalize";
import type { DynamicContext } from "@/lib/context-builder/v2/schema";

function takeTop<T extends { id: string }>(
  items: T[],
  scores: Map<string, ScoredEntityMeta>,
  limit: number,
  minScore = 1
): { selected: T[]; metas: ScoredEntityMeta[] } {
  const ranked = items
    .map((item) => ({
      item,
      meta: scores.get(item.id) || { entityId: item.id, score: 0, reasons: [] },
    }))
    .filter((x) => x.meta.score >= minScore)
    .sort((a, b) => b.meta.score - a.meta.score)
    .slice(0, Math.max(0, limit));
  return {
    selected: ranked.map((r) => r.item),
    metas: ranked.map((r) => r.meta),
  };
}

export function selectCharacters(
  req: ContextRequest,
  profile: OperationProfile,
  limits: ContextLimits
): {
  characters: DynamicContext["characters"];
  metas: ScoredEntityMeta[];
  selectedIds: Set<string>;
  excluded: number;
} {
  if (limits.maxCharacters <= 0) {
    return {
      characters: [],
      metas: [],
      selectedIds: new Set(),
      excluded: req.memory.characters.length,
    };
  }

  const scores = new Map<string, ScoredEntityMeta>();
  for (const c of req.memory.characters) {
    scores.set(c.id, scoreCharacter(c, req));
  }

  // Boost related characters via relationships once seeds are known
  const seedIds = new Set(findCharacterIdsInMessage(
    req.memory,
    req.userMessage,
    req.entities.characterNames || []
  ));
  for (const id of req.memory.continuity.activeCharacterIds || []) {
    seedIds.add(id);
  }

  for (const rel of req.memory.relationships) {
    if (rel.status === "superseded") continue;
    if (seedIds.has(rel.fromCharacterId) || seedIds.has(rel.toCharacterId)) {
      const other =
        seedIds.has(rel.fromCharacterId)
          ? rel.toCharacterId
          : rel.fromCharacterId;
      const meta = scores.get(other);
      if (meta && meta.score >= 0) {
        meta.score += 50;
        meta.reasons.push("directly related to selected entity");
      }
    }
  }

  const { selected, metas } = takeTop(
    req.memory.characters,
    scores,
    limits.maxCharacters,
    seedIds.size > 0 ? 45 : 5
  );

  // Always include seed characters even if low score
  const byId = new Map(selected.map((c) => [c.id, c]));
  for (const id of seedIds) {
    if (!byId.has(id) && byId.size < limits.maxCharacters) {
      const c = req.memory.characters.find((x) => x.id === id);
      if (c) {
        byId.set(c.id, c);
        metas.push(scores.get(c.id) || { entityId: c.id, score: 100, reasons: ["seed"] });
      }
    }
  }

  const final = [...byId.values()].slice(0, limits.maxCharacters);
  return {
    characters: final.map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases.slice(0, 6),
      role: c.role,
      gender: c.gender,
      age: c.age,
      occupation: c.occupation,
      personalityTraits: c.personalityTraits.slice(0, 8),
      goals: c.goals.slice(0, 4),
      fears: c.fears.slice(0, 4),
      strengths: c.strengths.slice(0, 4),
      weaknesses: c.weaknesses.slice(0, 4),
      currentState: c.currentState,
      status: c.status,
      notes: c.notes.slice(0, 4),
      avoid: c.avoid.slice(0, 4),
    })),
    metas,
    selectedIds: new Set(final.map((c) => c.id)),
    excluded: Math.max(0, req.memory.characters.length - final.length),
  };
}

export function selectRelationships(
  req: ContextRequest,
  selectedIds: Set<string>,
  limits: ContextLimits
): {
  relationships: DynamicContext["relationships"];
  metas: ScoredEntityMeta[];
  excluded: number;
} {
  if (limits.maxRelationships <= 0) {
    return {
      relationships: [],
      metas: [],
      excluded: req.memory.relationships.length,
    };
  }
  const names = nameLookup(req.memory);
  const scores = new Map<string, ScoredEntityMeta>();
  for (const r of req.memory.relationships) {
    scores.set(r.id, scoreRelationship(r, selectedIds, req));
  }
  const { selected, metas } = takeTop(
    req.memory.relationships.filter(
      (r) => r.status !== "superseded" && r.status !== "corrected"
    ),
    scores,
    limits.maxRelationships,
    1
  );
  return {
    relationships: selected.map((r) => ({
      id: r.id,
      fromCharacterId: r.fromCharacterId,
      toCharacterId: r.toCharacterId,
      fromName: names.get(r.fromCharacterId),
      toName: names.get(r.toCharacterId),
      type: r.type,
      label: r.label,
      status: r.status,
      mutual: r.mutual,
      recentHistory: (r.history || []).slice(-3),
      conflicts: (r.conflicts || []).slice(0, 3),
      secrets: (r.secrets || []).slice(0, 2),
    })),
    metas,
    excluded: Math.max(0, req.memory.relationships.length - selected.length),
  };
}

export function selectLocations(
  req: ContextRequest,
  limits: ContextLimits
): {
  locations: DynamicContext["locations"];
  metas: ScoredEntityMeta[];
  excluded: number;
} {
  if (limits.maxLocations <= 0) {
    return { locations: [], metas: [], excluded: req.memory.locations.length };
  }
  const scores = new Map<string, ScoredEntityMeta>();
  for (const loc of req.memory.locations) {
    scores.set(loc.id, scoreLocation(loc, req));
  }
  const { selected, metas } = takeTop(
    req.memory.locations,
    scores,
    limits.maxLocations,
    1
  );
  return {
    locations: selected.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      description: l.description
        ? l.description.slice(0, 240)
        : null,
      mood: l.mood,
      importance: l.importance,
    })),
    metas,
    excluded: Math.max(0, req.memory.locations.length - selected.length),
  };
}

export function selectEvents(
  req: ContextRequest,
  selectedIds: Set<string>,
  limits: ContextLimits
): {
  events: DynamicContext["events"];
  metas: ScoredEntityMeta[];
  excluded: number;
} {
  if (limits.maxEvents <= 0) {
    return { events: [], metas: [], excluded: req.memory.events.length };
  }
  const scores = new Map<string, ScoredEntityMeta>();
  for (const ev of req.memory.events) {
    scores.set(ev.id, scoreEvent(ev, selectedIds, req));
  }
  const { selected, metas } = takeTop(
    req.memory.events,
    scores,
    limits.maxEvents,
    1
  );
  // Prefer chronological order among selected
  const ordered = [...selected].sort((a, b) => {
    const ao = a.order ?? a.episodeNumber ?? 0;
    const bo = b.order ?? b.episodeNumber ?? 0;
    return ao - bo;
  });
  return {
    events: ordered.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ? e.description.slice(0, 200) : null,
      type: e.type,
      episodeNumber: e.episodeNumber,
      characterIds: e.characterIds,
      locationId: e.locationId,
      importance: e.importance,
      order: e.order,
    })),
    metas,
    excluded: Math.max(0, req.memory.events.length - ordered.length),
  };
}

export function selectThreads(
  req: ContextRequest,
  selectedIds: Set<string>,
  limits: ContextLimits
): {
  openThreads: DynamicContext["openThreads"];
  metas: ScoredEntityMeta[];
  excluded: number;
} {
  if (limits.maxOpenThreads <= 0) {
    return {
      openThreads: [],
      metas: [],
      excluded: req.memory.openThreads.length,
    };
  }
  const scores = new Map<string, ScoredEntityMeta>();
  for (const t of req.memory.openThreads) {
    scores.set(t.id, scoreThread(t, selectedIds, req));
  }
  const { selected, metas } = takeTop(
    req.memory.openThreads,
    scores,
    limits.maxOpenThreads,
    10
  );
  return {
    openThreads: selected.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ? t.description.slice(0, 160) : null,
      status: t.status,
      priority: t.priority,
      relatedCharacterIds: t.relatedCharacterIds,
    })),
    metas,
    excluded: Math.max(0, req.memory.openThreads.length - selected.length),
  };
}

export function selectWritingRules(
  req: ContextRequest,
  profile: OperationProfile,
  limits: ContextLimits
): {
  writingRules: DynamicContext["writingRules"];
  metas: ScoredEntityMeta[];
  excluded: number;
} {
  if (limits.maxWritingRules <= 0) {
    return {
      writingRules: [],
      metas: [],
      excluded: req.memory.writingRules.length,
    };
  }
  const scores = new Map<string, ScoredEntityMeta>();
  const seenNorm = new Set<string>();
  const unique = req.memory.writingRules.filter((r) => {
    const n = normalizeRuleText(r.rule);
    if (seenNorm.has(n)) return false;
    seenNorm.add(n);
    return true;
  });
  for (const r of unique) {
    scores.set(r.id, scoreWritingRule(r, req, profile.id));
  }
  const { selected, metas } = takeTop(unique, scores, limits.maxWritingRules, 1);

  // Never drop critical/high if present and under cap
  const must = unique.filter((r) => {
    const p = (r.priority || "").toLowerCase();
    return r.active && (p === "critical" || p === "high" || p === "important");
  });
  const byId = new Map(selected.map((r) => [r.id, r]));
  for (const r of must) {
    if (!byId.has(r.id) && byId.size < limits.maxWritingRules) {
      byId.set(r.id, r);
      metas.push(scores.get(r.id)!);
    }
  }

  return {
    writingRules: [...byId.values()].map((r) => ({
      id: r.id,
      rule: r.rule,
      category: r.category,
      priority: r.priority,
      active: r.active,
    })),
    metas,
    excluded: Math.max(0, req.memory.writingRules.length - byId.size),
  };
}

export function selectSecrets(
  req: ContextRequest,
  selectedIds: Set<string>,
  profile: OperationProfile,
  limits: ContextLimits
): {
  secrets: DynamicContext["secrets"];
  knowledge: DynamicContext["knowledge"];
  excluded: number;
} {
  if (limits.maxSecrets <= 0) {
    return {
      secrets: [],
      knowledge: { authorKnowledge: [], characterKnowledge: {} },
      excluded: req.memory.secrets.length,
    };
  }

  const relevant = req.memory.secrets.filter((s) => {
    if (profile.authorSecretsOk || req.authorPlanning) return true;
    if (s.revealed) return true;
    return (
      s.knownByCharacterIds.some((id) => selectedIds.has(id)) ||
      s.hiddenFromCharacterIds.some((id) => selectedIds.has(id))
    );
  });

  const picked = relevant.slice(0, limits.maxSecrets);
  const authorKnowledge: string[] = [];
  const characterKnowledge: Record<string, string[]> = {};

  for (const s of picked) {
    if (profile.authorSecretsOk || req.authorPlanning) {
      authorKnowledge.push(s.title);
    }
    for (const id of selectedIds) {
      if (s.hiddenFromCharacterIds.includes(id)) continue;
      if (s.knownByCharacterIds.includes(id) || s.revealed) {
        characterKnowledge[id] = characterKnowledge[id] || [];
        characterKnowledge[id].push(s.title);
      }
    }
  }

  // For ordinary scene gen: only expose secrets needed for continuity
  // (character knowledge map), keep secrets array for author planning only
  const secretsOut =
    profile.authorSecretsOk || req.authorPlanning
      ? picked.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description ? s.description.slice(0, 160) : null,
          knownByCharacterIds: s.knownByCharacterIds,
          hiddenFromCharacterIds: s.hiddenFromCharacterIds,
          revealed: s.revealed,
          importance: s.importance,
        }))
      : [];

  return {
    secrets: secretsOut,
    knowledge: { authorKnowledge, characterKnowledge },
    excluded: Math.max(0, req.memory.secrets.length - picked.length),
  };
}

export function selectPromises(
  req: ContextRequest,
  selectedIds: Set<string>,
  limits: ContextLimits
): { promises: DynamicContext["promises"]; excluded: number } {
  if (limits.maxPromises <= 0) {
    return { promises: [], excluded: req.memory.promises.length };
  }
  const relevant = req.memory.promises.filter(
    (p) =>
      p.status === "active" &&
      ((p.madeByCharacterId && selectedIds.has(p.madeByCharacterId)) ||
        (p.madeToCharacterId && selectedIds.has(p.madeToCharacterId)))
  );
  const picked = relevant.slice(0, limits.maxPromises);
  return {
    promises: picked.map((p) => ({
      id: p.id,
      text: p.text,
      madeByCharacterId: p.madeByCharacterId,
      madeToCharacterId: p.madeToCharacterId,
      status: p.status,
    })),
    excluded: Math.max(0, req.memory.promises.length - picked.length),
  };
}

export function selectPreferences(
  req: ContextRequest,
  profile: OperationProfile
): Record<string, unknown> {
  const p = req.memory.userPreferences;
  const prose = [
    "write_scene",
    "write_episode",
    "continue_story",
    "rewrite",
    "make_emotional",
    "make_romantic",
    "make_funny",
    "shorten",
    "expand",
    "generate_dialogue",
    "generate_description",
  ].includes(profile.id);

  if (prose) {
    return {
      storyLanguage: p.storyLanguage || p.narrationLanguage || p.language,
      narrationStyle: p.narrationStyle,
      dialogueStyle: p.dialogueStyle,
      pacing: p.pacing || p.pacingHint,
      pov: p.pov,
      avoid: p.avoid,
      tone: p.tone,
      uppercaseForLoudDialogue: p.uppercaseForLoudDialogue,
      slowBurn: p.slowBurn,
      dialogueLanguage: p.dialogueLanguage,
      narrationLanguage: p.narrationLanguage,
    };
  }

  return {
    responseLanguage: p.responseLanguage || p.dialogueLanguage || p.language,
    emojiLevel: p.emojiLevel || p.emojiStyle,
    tone: p.tone,
    dialogueLanguage: p.dialogueLanguage,
    doNotStartYet: p.doNotStartYet,
  };
}

export function selectConversation(
  req: ContextRequest,
  profile: OperationProfile,
  limits: ContextLimits
): DynamicContext["recentConversation"] {
  if (!profile.includeRecentMessages || limits.maxRecentMessages <= 0) {
    return [];
  }

  const messages = req.recentMessages || [];
  const out: DynamicContext["recentConversation"] = [];

  // Always keep latest user message
  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  if (latestUser) {
    out.push({
      role: latestUser.role,
      content: truncateMsg(latestUser.content, 500),
      reason: "latest user message",
    });
  }

  // Awaiting assistant question
  if (
    req.conversationFlow?.awaiting &&
    req.conversationFlow.awaiting.type !== "none"
  ) {
    const lastAsst = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && /\?/.test(m.content));
    if (lastAsst) {
      out.push({
        role: lastAsst.role,
        content: truncateMsg(lastAsst.content, 400),
        reason: "awaiting question",
      });
    }
  }

  // Recent corrections / writing instructions
  for (const m of [...messages].reverse()) {
    if (out.length >= limits.maxRecentMessages) break;
    if (out.some((o) => o.content === truncateMsg(m.content, 500))) continue;
    if (isNoiseMessage(m.content)) continue;
    const relevant =
      /correction|actually|nahi|rewrite|emotional|continue|hinglish|likho/i.test(
        m.content
      ) ||
      (req.entities.characterNames || []).some((n) =>
        m.content.toLowerCase().includes(n.toLowerCase())
      );
    if (relevant || out.length < 3) {
      out.push({
        role: m.role,
        content: truncateMsg(m.content, 400),
        reason: relevant ? "topic relevance" : "recent",
      });
    }
  }

  return out.slice(0, limits.maxRecentMessages);
}

function truncateMsg(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function isNoiseMessage(content: string): boolean {
  const c = content.toLowerCase();
  if (/couldn.?t finish|provider|timeout|rate limit|unreadable/i.test(c)) {
    return true;
  }
  if (/^(hey|hi|hello)[.!]?$/i.test(c.trim())) return true;
  return false;
}
