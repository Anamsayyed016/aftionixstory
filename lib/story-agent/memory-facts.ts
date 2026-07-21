/**
 * Deterministic story-fact extraction for memory updates.
 * No hardcoded character names — works for any cast.
 */

import type { MemoryPatch, StoryMemory } from "@/lib/story-agent/schema";
import {
  isReservedPseudoEntityName,
  isValidCanonicalEntityName,
} from "@/lib/story-agent/entity-guards";

export type MemoryFactExtraction = {
  matched: boolean;
  confidence: "high" | "medium";
  matchedSignals: string[];
  patch: MemoryPatch;
  confirmReply: string;
};

function titleCase(name: string): string {
  const t = name.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isName(raw: string): boolean {
  return isValidCanonicalEntityName(raw);
}

function emptyPatch(): MemoryPatch {
  return {
    story: {},
    characters: [],
    relationships: [],
    writingRules: [],
    preferences: {},
    remove: [],
  };
}

/**
 * Detect explicit character/relationship/preference facts in free text.
 */
export function extractMemoryFacts(
  message: string,
  memory?: StoryMemory | null
): MemoryFactExtraction {
  const text = message.trim();
  const patch = emptyPatch();
  const signals: string[] = [];
  const charMap = new Map<
    string,
    {
      name: string;
      role?: string;
      personality: string[];
      notes: string[];
      avoid: string[];
    }
  >();

  const upsertChar = (
    name: string,
    fields: {
      role?: string;
      personalityAdd?: string[];
      notesAdd?: string[];
      avoidAdd?: string[];
    }
  ) => {
    if (!isName(name)) return;
    const key = name.toLowerCase();
    const display = titleCase(name);
    const existing = charMap.get(key) || {
      name: display,
      personality: [] as string[],
      notes: [] as string[],
      avoid: [] as string[],
    };
    if (fields.role) existing.role = fields.role;
    for (const p of fields.personalityAdd ?? []) {
      if (p && !existing.personality.includes(p)) existing.personality.push(p);
    }
    for (const n of fields.notesAdd ?? []) {
      if (n && !existing.notes.includes(n)) existing.notes.push(n);
    }
    for (const a of fields.avoidAdd ?? []) {
      if (a && !existing.avoid.includes(a)) existing.avoid.push(a);
    }
    charMap.set(key, existing);
  };

  // Role assignments: "Azar male lead", "Anaya female lead/heroine"
  const roleRe =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+(?:is\s+|as\s+|=\s*)?(male\s+lead|female\s+lead|male\s+protagonist|female\s+protagonist|heroine|hero|protagonist|antagonist|villain)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = roleRe.exec(text)) !== null) {
    const role = m[2].toLowerCase().replace(/\s+/g, " ");
    upsertChar(m[1], { role });
    signals.push("role_assignment");
  }

  // "Name role lead" without "is": already covered by roleRe with optional is/as

  // Personality: "Anaya innocent hai but childish nahi"
  const traitPositive =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+(?:is\s+|bahut\s+)?(innocent|soft|kind|brave|angry|jealous|loyal|shy|bold|smart|caring)\s*(hai|hain)?\b/gi;
  while ((m = traitPositive.exec(text)) !== null) {
    upsertChar(m[1], { personalityAdd: [m[2].toLowerCase()] });
    signals.push("personality_add");
  }
  const traitNegative =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+(?:is\s+)?(?:not\s+|nahi\s+)?(childish|weak|evil|cruel)\s*(nahi|hai|hain)?\b/gi;
  while ((m = traitNegative.exec(text)) !== null) {
    const neg =
      /nahi|not/i.test(m[0]) || /nahi/i.test(m[3] || "");
    if (neg) {
      upsertChar(m[1], { avoidAdd: [m[2].toLowerCase()] });
      signals.push("personality_avoid");
    } else {
      upsertChar(m[1], { personalityAdd: [m[2].toLowerCase()] });
      signals.push("personality_add");
    }
  }
  // Explicit: "childish nahi"
  const avoidTrait =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+(\w+)\s+nahi\b/gi;
  while ((m = avoidTrait.exec(text)) !== null) {
    if (isName(m[1]) && !isReservedPseudoEntityName(m[2])) {
      upsertChar(m[1], { avoidAdd: [m[2].toLowerCase()] });
      signals.push("trait_negation");
    }
  }

  // Relationships: "Sameer Anaya ka father hai" / "Alya Azar ki daughter hai"
  const relHinglish =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+([A-Za-z][A-Za-z'-]{1,30})\s+k[ai]\s+(father|mother|uncle|aunt|daughter|son|brother|sister|friend|rival|boss|student)\s+hai\b/gi;
  while ((m = relHinglish.exec(text)) !== null) {
    if (!isName(m[1]) || !isName(m[2])) continue;
    patch.relationships.push({
      from: titleCase(m[1]),
      to: titleCase(m[2]),
      type: m[3].toLowerCase(),
    });
    upsertChar(m[1], {});
    upsertChar(m[2], {});
    signals.push("relationship_hinglish");
  }

  // "X is Y's father/uncle"
  const relEnglish =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+is\s+([A-Za-z][A-Za-z'-]{1,30})(?:['’]s)?\s+(father|mother|uncle|aunt|daughter|son|brother|sister|friend|rival)\b/gi;
  while ((m = relEnglish.exec(text)) !== null) {
    if (!isName(m[1]) || !isName(m[2])) continue;
    patch.relationships.push({
      from: titleCase(m[1]),
      to: titleCase(m[2]),
      type: m[3].toLowerCase(),
    });
    upsertChar(m[1], {});
    upsertChar(m[2], {});
    signals.push("relationship_english");
  }

  // Corrections: "Sameer father nahi uncle hai" / "Sameer Anaya ka father nahi uncle hai"
  const relCorrectFull =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+([A-Za-z][A-Za-z'-]{1,30})\s+k[ai]\s+(father|mother|uncle|aunt|daughter|son|brother|sister)\s+nahi\s+(father|mother|uncle|aunt|daughter|son|brother|sister)\s+hai\b/gi;
  while ((m = relCorrectFull.exec(text)) !== null) {
    if (!isName(m[1]) || !isName(m[2])) continue;
    signals.push("relationship_correction");
    patch.remove.push({
      type: "relationship",
      from: titleCase(m[1]),
      to: titleCase(m[2]),
    });
    patch.relationships.push({
      from: titleCase(m[1]),
      to: titleCase(m[2]),
      type: m[4].toLowerCase(),
    });
    upsertChar(m[1], {});
    upsertChar(m[2], {});
  }

  const relCorrectShort =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+(father|mother|uncle|aunt|daughter|son)\s+nahi\s+(uncle|aunt|father|mother|daughter|son)\s+hai\b/gi;
  while ((m = relCorrectShort.exec(text)) !== null) {
    if (!isName(m[1])) continue;
    signals.push("relationship_correction");
    const fromName = titleCase(m[1]);
    const oldType = m[2].toLowerCase();
    const newType = m[3].toLowerCase();
    const existing = (memory?.relationships ?? []).filter(
      (r) =>
        r.from.trim().toLowerCase() === fromName.toLowerCase() &&
        r.type.trim().toLowerCase() === oldType
    );
    if (existing.length > 0) {
      for (const r of existing) {
        patch.remove.push({
          type: "relationship",
          from: r.from,
          to: r.to,
        });
        patch.relationships.push({
          from: r.from,
          to: r.to,
          type: newType,
        });
      }
    } else {
      upsertChar(fromName, {
        notesAdd: [`is ${newType}, not ${oldType}`],
      });
    }
  }

  // Remove character
  const removeRe =
    /\b(?:remove|hata\s+do|delete)\s+([A-Za-z][A-Za-z'-]{1,30})\b/gi;
  while ((m = removeRe.exec(text)) !== null) {
    if (!isName(m[1])) continue;
    patch.remove.push({ type: "character", name: titleCase(m[1]) });
    signals.push("remove_character");
  }

  // Anger issues / notes: "Azar ko anger issues hain"
  const issuesRe =
    /\b([A-Za-z][A-Za-z'-]{1,30})\s+ko\s+(.+?)\s+hain?\b/gi;
  while ((m = issuesRe.exec(text)) !== null) {
    if (!isName(m[1])) continue;
    const note = m[2].trim();
    if (note.length >= 3 && note.length <= 80) {
      upsertChar(m[1], { notesAdd: [note], personalityAdd: note.toLowerCase().includes("anger") ? ["anger issues"] : [] });
      signals.push("character_note");
    }
  }

  for (const c of charMap.values()) {
    patch.characters.push({
      name: c.name,
      role: c.role,
      personality: c.personality,
      goals: [],
      conflicts: [],
      notes: c.notes,
      avoid: c.avoid,
    });
  }

  const matched =
    patch.characters.length > 0 ||
    patch.relationships.length > 0 ||
    patch.remove.length > 0;

  if (!matched) {
    return {
      matched: false,
      confidence: "medium",
      matchedSignals: [],
      patch: emptyPatch(),
      confirmReply: "",
    };
  }

  return {
    matched: true,
    confidence: "high",
    matchedSignals: [...new Set(signals)],
    patch,
    confirmReply: buildMemoryConfirmReply(patch),
  };
}

export function looksLikeMemoryFactMessage(
  message: string,
  memory?: StoryMemory | null
): boolean {
  return extractMemoryFacts(message, memory).matched;
}

export function buildMemoryConfirmReply(patch: MemoryPatch): string {
  const parts: string[] = [];
  for (const c of patch.characters) {
    const bits = [c.name];
    if (c.role) bits.push(c.role);
    if (c.personality?.length) bits.push(c.personality.join(", "));
    if (c.avoid?.length) bits.push(`not ${c.avoid.join(", ")}`);
    parts.push(bits.join(" — "));
  }
  for (const r of patch.relationships) {
    parts.push(`${r.from} → ${r.to} (${r.type})`);
  }
  for (const rem of patch.remove) {
    if (rem.type === "character" && rem.name) {
      parts.push(`removed ${rem.name}`);
    }
  }

  const summary = parts.slice(0, 4).join("; ");
  const names = patch.characters.map((c) => c.name).filter(Boolean);
  const followUp =
    names.length >= 2
      ? `Ab ${names[0]} aur ${names[1]} ka connection ya central conflict batao, ya main options suggest karun?`
      : names.length === 1
        ? `Aur kuch add karna hai ${names[0]} ke bare me, ya next step bataye?`
        : "Aur kya update karna hai?";

  return `Got it ❤️ ${summary}. ${followUp}`;
}
