/**
 * Deterministic relevance scoring (Phase D) — no embeddings.
 */

import type { ContextRequest } from "@/lib/context-builder/v2/request";
import type { ScoredEntityMeta } from "@/lib/context-builder/v2/schema";
import {
  normalizeKey,
  normalizeName,
  normalizeLocationKey,
} from "@/lib/story-memory/v2/normalize";
import type {
  CharacterV2,
  EventV2,
  LocationV2,
  OpenThreadV2,
  RelationshipV2,
  StoryMemoryV2,
  WritingRuleV2,
} from "@/lib/story-memory/v2";

export type ScoreResult = ScoredEntityMeta;

function msgHaystack(req: ContextRequest): string {
  return [
    req.userMessage,
    ...req.recentMessages.slice(-6).map((m) => m.content),
  ]
    .join("\n")
    .toLowerCase();
}

function mentioned(haystack: string, name: string): boolean {
  const n = normalizeName(name);
  if (!n || n.length < 2) return false;
  return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
    haystack
  );
}

export function scoreCharacter(
  character: CharacterV2,
  req: ContextRequest
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  const hay = msgHaystack(req);
  const names = [character.name, ...character.aliases];

  if (names.some((n) => mentioned(req.userMessage.toLowerCase(), n))) {
    score += 100;
    reasons.push("explicitly mentioned");
  } else if (names.some((n) => mentioned(hay, n))) {
    score += 20;
    reasons.push("recent-message mention");
  }

  const routerNames = (req.entities.characterNames || []).map(normalizeName);
  if (routerNames.some((n) => names.some((x) => normalizeName(x) === n))) {
    score += 80;
    reasons.push("router-extracted entity");
  }

  if (req.memory.continuity.activeCharacterIds?.includes(character.id)) {
    score += 60;
    reasons.push("active character");
  }

  if (character.status === "active") score += 5;
  if (character.role && /lead|protagonist|hero|heroine/i.test(character.role)) {
    score += 10;
    reasons.push("lead role");
  }

  // Draft mention
  const draft = req.memory.latestDraft?.content?.toLowerCase() || "";
  if (draft && names.some((n) => mentioned(draft, n))) {
    score += 15;
    reasons.push("latestDraft mention");
  }

  return { entityId: character.id, score, reasons };
}

export function scoreRelationship(
  rel: RelationshipV2,
  selectedCharIds: Set<string>,
  req: ContextRequest
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  if (rel.status === "superseded" || rel.status === "corrected") {
    return { entityId: rel.id, score: -100, reasons: ["superseded"] };
  }
  if (
    selectedCharIds.has(rel.fromCharacterId) ||
    selectedCharIds.has(rel.toCharacterId)
  ) {
    score += 50;
    reasons.push("endpoint selected");
  }
  const hay = req.userMessage.toLowerCase();
  if (mentioned(hay, rel.type) || (rel.label && mentioned(hay, rel.label))) {
    score += 100;
    reasons.push("explicitly mentioned");
  }
  if (rel.conflicts?.length) {
    score += 10;
    reasons.push("has conflicts");
  }
  return { entityId: rel.id, score, reasons };
}

export function scoreLocation(
  loc: LocationV2,
  req: ContextRequest
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  if (req.memory.continuity.currentLocationId === loc.id) {
    score += 60;
    reasons.push("current location");
  }
  if (mentioned(req.userMessage.toLowerCase(), loc.name)) {
    score += 100;
    reasons.push("explicitly mentioned");
  }
  const key = normalizeLocationKey(loc.name);
  if (normalizeLocationKey(req.userMessage).includes(key) && key.length > 2) {
    score += 40;
    reasons.push("message location match");
  }
  if (loc.importance === "major" || loc.importance === "critical") score += 10;
  return { entityId: loc.id, score, reasons };
}

export function scoreEvent(
  event: EventV2,
  selectedCharIds: Set<string>,
  req: ContextRequest
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  if (
    req.entities.episodeNumber != null &&
    event.episodeNumber === req.entities.episodeNumber
  ) {
    score += 100;
    reasons.push("episode match");
  }
  if (event.characterIds.some((id) => selectedCharIds.has(id))) {
    score += 40;
    reasons.push("involves selected character");
  }
  if (
    req.memory.continuity.currentLocationId &&
    event.locationId === req.memory.continuity.currentLocationId
  ) {
    score += 30;
    reasons.push("current location event");
  }
  if (event.importance === "major" || event.importance === "critical") {
    score += 20;
    reasons.push("important");
  }
  if (typeof event.order === "number") score += Math.max(0, 10 - event.order);
  return { entityId: event.id, score, reasons };
}

export function scoreThread(
  thread: OpenThreadV2,
  selectedCharIds: Set<string>,
  req: ContextRequest
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  if (thread.status !== "open" && thread.status !== "paused") {
    return { entityId: thread.id, score: -50, reasons: ["not open"] };
  }
  if (thread.relatedCharacterIds.some((id) => selectedCharIds.has(id))) {
    score += 30;
    reasons.push("open-thread involvement");
  }
  if (mentioned(req.userMessage.toLowerCase(), thread.title)) {
    score += 100;
    reasons.push("explicitly mentioned");
  }
  if (thread.priority === "high" || thread.priority === "critical") score += 15;
  if (req.memory.continuity.currentConflict) {
    const conflict = String(req.memory.continuity.currentConflict).toLowerCase();
    if (thread.title.toLowerCase().includes(conflict.slice(0, 20))) {
      score += 40;
      reasons.push("current conflict");
    }
  }
  return { entityId: thread.id, score, reasons };
}

export function scoreWritingRule(
  rule: WritingRuleV2,
  req: ContextRequest,
  intent: string
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;
  if (!rule.active) return { entityId: rule.id, score: -100, reasons: ["inactive"] };

  const p = (rule.priority || "normal").toLowerCase();
  if (p === "critical") {
    score += 100;
    reasons.push("critical priority");
  } else if (p === "high" || p === "important") {
    score += 70;
    reasons.push("high priority");
  } else {
    score += 20;
  }

  const cat = (rule.category || "").toLowerCase();
  const text = rule.rule.toLowerCase();
  if (
    /language|hinglish|hindi|english|dialogue/.test(text + cat) &&
    /language|dialogue|chat|write/.test(intent + req.userMessage.toLowerCase())
  ) {
    score += 40;
    reasons.push("language/dialogue relevant");
  }
  if (
    /emotion|romantic|funny|tone|style/.test(text + cat) &&
    /emotional|romantic|funny|tone|style|rewrite/.test(intent)
  ) {
    score += 40;
    reasons.push("tone/style relevant");
  }
  if (/teaser/.test(text) && /teaser/.test(req.userMessage.toLowerCase())) {
    score += 50;
    reasons.push("teaser rule");
  }
  return { entityId: rule.id, score, reasons };
}

export function nameLookup(memory: StoryMemoryV2): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of memory.characters) {
    map.set(c.id, c.name);
    map.set(normalizeName(c.name), c.id);
    for (const a of c.aliases) map.set(normalizeName(a), c.id);
  }
  return map;
}

export function findCharacterIdsInMessage(
  memory: StoryMemoryV2,
  message: string,
  routerNames: string[]
): string[] {
  const ids = new Set<string>();
  const lower = message.toLowerCase();
  for (const c of memory.characters) {
    if (mentioned(lower, c.name) || c.aliases.some((a) => mentioned(lower, a))) {
      ids.add(c.id);
    }
  }
  for (const name of routerNames) {
    const hit = memory.characters.find(
      (c) =>
        normalizeName(c.name) === normalizeName(name) ||
        c.aliases.some((a) => normalizeName(a) === normalizeName(name))
    );
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}

export { normalizeKey, normalizeName };
