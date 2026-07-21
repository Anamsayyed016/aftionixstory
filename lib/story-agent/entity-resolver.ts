/**
 * Dynamic entity resolution from the current user message + active memory.
 * No hardcoded character names — works for any cast.
 */

import type { StoryMemory } from "@/lib/story-agent/schema";
import { isValidCanonicalEntityName } from "@/lib/story-agent/entity-guards";

export type ResolvedSceneRequest = {
  requestedCharacters: Array<{ name: string; role?: string; source: string }>;
  /** Canonical display names (prefer memory casing). */
  characterNames: string[];
  actionHints: string[];
  conflictHints: string[];
  settingOverride?: string;
  refersToPreviousDraft: boolean;
  fingerprints: string[];
};

function titleCaseName(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isPlausibleName(raw: string): boolean {
  return isValidCanonicalEntityName(raw);
}

function pushUnique(
  list: Array<{ name: string; role?: string; source: string }>,
  name: string,
  role: string | undefined,
  source: string
) {
  if (!isPlausibleName(name)) return;
  const key = name.toLowerCase();
  if (list.some((c) => c.name.toLowerCase() === key)) return;
  list.push({ name: titleCaseName(name), role, source });
}

/**
 * Extract character mentions from free text (case-insensitive).
 * Supports: "between X and Y", "X (role)", "X–Y", "X kiss Y", "Build the X … Y".
 */
export function extractMentionedCharacters(
  message: string
): Array<{ name: string; role?: string }> {
  const found: Array<{ name: string; role?: string; source: string }> = [];
  const text = message.trim();

  const withRole =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s*\(([^)]{1,80})\)/g;
  let m: RegExpExecArray | null;
  while ((m = withRole.exec(text)) !== null) {
    pushUnique(found, m[1], m[2].trim(), "role_paren");
  }

  const between = text.match(
    /\bbetween\s+([A-Za-z][A-Za-z'-]{1,30})(?:\s*\([^)]*\))?\s+and\s+([A-Za-z][A-Za-z'-]{1,30})/i
  );
  if (between) {
    pushUnique(found, between[1], undefined, "between");
    pushUnique(found, between[2], undefined, "between");
  }

  const dashPair = text.match(
    /\b([A-Za-z][A-Za-z'-]{1,30})\s*[-–—]\s*([A-Za-z][A-Za-z'-]{1,30})\b/
  );
  if (dashPair) {
    pushUnique(found, dashPair[1], undefined, "dash_pair");
    pushUnique(found, dashPair[2], undefined, "dash_pair");
  }

  const actionPair = text.match(
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+(?:kiss|hug|meet|fight|argue|confront|scene(?:\s+with)?)\s+([A-Za-z][A-Za-z'-]{1,30})\b/i
  );
  if (actionPair) {
    pushUnique(found, actionPair[1], undefined, "action_pair");
    pushUnique(found, actionPair[2], undefined, "action_pair");
  }

  return found.map(({ name, role }) => ({ name, role }));
}

export function resolveSceneRequest(
  userMessage: string,
  memory?: StoryMemory | null
): ResolvedSceneRequest {
  const text = userMessage.trim();
  const mentioned = extractMentionedCharacters(text);
  const requested: Array<{ name: string; role?: string; source: string }> =
    mentioned.map((c) => ({
      name: c.name,
      role: c.role,
      source: "message",
    }));

  // Match known memory characters mentioned anywhere in the message
  for (const c of memory?.characters ?? []) {
    if (!c.name?.trim() || !isPlausibleName(c.name)) continue;
    const re = new RegExp(
      `\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(text)) {
      pushUnique(requested, c.name, c.role, "memory_mention");
    }
  }

  // Prefer memory casing for display
  let characterNames = requested.map((r) => {
    const mem = memory?.characters.find(
      (c) => c.name.toLowerCase() === r.name.toLowerCase()
    );
    return mem?.name ?? r.name;
  });

  // Continuation commands normally say only “continue” or “start now”. In
  // that case the active cast must still reach both the prompt and the output
  // relevance guard. Keep this intentionally small: an opening needs leads,
  // not the whole ensemble in every scene.
  if (characterNames.length === 0 && memory?.characters.length) {
    characterNames = memory.characters
      .filter((c) => c.name.trim() && isPlausibleName(c.name))
      .slice(0, 2)
      .map((c) => c.name);
    for (const name of characterNames) {
      requested.push({ name, source: "memory_context" });
    }
  }

  const actionHints: string[] = [];
  if (/\bkiss\b/i.test(text)) actionHints.push("kiss / intimate closeness");
  if (/\bhug\b/i.test(text)) actionHints.push("hug");
  if (/\bargument|fight|argue\b/i.test(text)) actionHints.push("argument");
  if (/\bconfession\b/i.test(text)) actionHints.push("confession");
  if (/\bscene\b/i.test(text)) actionHints.push("scene");

  const conflictHints: string[] = [];
  if (/\binternal\s+conflict\b/i.test(text)) {
    conflictHints.push("internal conflict");
  } else if (/\bconflict\b/i.test(text)) {
    conflictHints.push("conflict");
  }
  if (/\bguilt\b/i.test(text)) conflictHints.push("guilt");
  if (/\bfear\b/i.test(text)) conflictHints.push("fear");

  let settingOverride: string | undefined;
  const office = text.match(/\bin\s+([A-Za-z][\w'-]*(?:['’]s)?\s+office)\b/i);
  if (office) settingOverride = office[1].trim();
  const inPlace = text.match(
    /\b(?:in|at)\s+(?:an?\s+)?([A-Za-z][\w\s'-]{2,40}?)\s*$/i
  );
  if (!settingOverride && inPlace && /\b(office|room|hospital|campus|cafe)\b/i.test(inPlace[1])) {
    settingOverride = inPlace[1].trim();
  }

  const refersToPreviousDraft =
    /\b(previous|last|this|earlier)\s+(scene|draft|episode)\b/i.test(text) ||
    /\brewrite\b/i.test(text) ||
    /\brevise\b/i.test(text) ||
    /\bcontinue\b/i.test(text) ||
    /\baage\s+likho\b/i.test(text) ||
    /\bmake\s+(it|the\s+previous)\b/i.test(text);

  const fingerprints = characterNames.map(
    (n) => `${n.length}:${n.slice(0, 12).toLowerCase()}`
  );

  return {
    requestedCharacters: requested,
    characterNames,
    actionHints,
    conflictHints,
    settingOverride,
    refersToPreviousDraft,
    fingerprints,
  };
}

/** True when message clearly asks to write/build a scene (not revise). */
export function looksLikeFreshSceneRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (
    /\b(rewrite|revise|previous\s+scene|make\s+the\s+previous|continue\s+from|aage\s+likho)\b/i.test(
      text
    )
  ) {
    return false;
  }
  return (
    /\b(write|build|create|make)\b.+\b(scene|kiss|moment|argument|opening)\b/i.test(
      text
    ) ||
    /\b(kiss|argument|fight|confession)\s+scene\b/i.test(text) ||
    /\bscene\s+between\b/i.test(text) ||
    /\baround\s+an?\s+(internal\s+)?conflict\b/i.test(text) ||
    /\bmake\s+their\s+\w+\s+emotionally\b/i.test(text) ||
    /\bek\s+scene\s+likh/i.test(text) ||
    /\bscene\s+likho\b/i.test(text)
  );
}
