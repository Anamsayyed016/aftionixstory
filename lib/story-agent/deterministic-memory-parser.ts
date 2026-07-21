/**
 * Deterministic story-fact / setup parsing without an AI call.
 * Extends name-based memory facts with role-pair and hero/heroine occupation patterns.
 */

import {
  buildMemoryConfirmReply,
  extractMemoryFacts,
} from "@/lib/story-agent/memory-facts";
import { isReservedPseudoEntityName } from "@/lib/story-agent/entity-guards";
import type { MemoryPatch, StoryMemory } from "@/lib/story-agent/schema";

export type DeterministicParseKind =
  | "character_role"
  | "character_trait"
  | "relationship"
  | "role_pair_setup"
  | "occupation_role"
  | "none";

export type DeterministicParseResult = {
  matched: boolean;
  kind: DeterministicParseKind;
  confidence: "high" | "medium";
  matchedSignals: string[];
  patch: MemoryPatch;
  /** Roles/labels used for dynamic confirmation (never hardcoded reply text). */
  entities: {
    characterNames: string[];
    roles: string[];
    relationshipTypes: string[];
  };
};

const ROLE_PAIR_WORDS = new Set(
  [
    "ceo",
    "intern",
    "doctor",
    "student",
    "teacher",
    "professor",
    "boss",
    "owner",
    "manager",
    "lawyer",
    "nurse",
    "pilot",
    "chef",
    "artist",
    "writer",
    "actor",
    "actress",
    "king",
    "queen",
    "prince",
    "princess",
    "soldier",
    "detective",
    "journalist",
    "singer",
    "dancer",
    "coach",
    "athlete",
    "rival",
    "landlord",
    "tenant",
    "bodyguard",
    "assistant",
    "secretary",
    "founder",
    "heir",
    "heiress",
  ].map((s) => s.toLowerCase())
);

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

function titleCaseRole(role: string): string {
  const t = role.trim();
  if (!t) return t;
  if (t.toUpperCase() === t && t.length <= 4) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function isRoleWord(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return !isReservedPseudoEntityName(value) && ROLE_PAIR_WORDS.has(value);
}

function entitiesFromPatch(patch: MemoryPatch): DeterministicParseResult["entities"] {
  return {
    characterNames: patch.characters.map((c) => c.name).filter(Boolean),
    roles: patch.characters.map((c) => c.role || c.name).filter(Boolean) as string[],
    relationshipTypes: patch.relationships.map((r) => r.type),
  };
}

/**
 * Parse story facts / setup from the user message without calling a provider.
 */
export function parseDeterministicMemory(
  message: string,
  memory?: StoryMemory | null
): DeterministicParseResult {
  const text = message.trim();
  if (!text) {
    return {
      matched: false,
      kind: "none",
      confidence: "medium",
      matchedSignals: [],
      patch: emptyPatch(),
      entities: { characterNames: [], roles: [], relationshipTypes: [] },
    };
  }

  // Role pair setup: "CEO and intern", "doctor and student"
  const pair = text.match(
    /^\s*([A-Za-z][A-Za-z'-]{1,24})\s+and\s+([A-Za-z][A-Za-z'-]{1,24})\s*[.!?]*\s*$/i
  );
  if (pair && isRoleWord(pair[1]) && isRoleWord(pair[2])) {
    const roleA = titleCaseRole(pair[1]);
    const roleB = titleCaseRole(pair[2]);
    const patch = emptyPatch();
    patch.story = {
      concept: `${roleA} and ${roleB} story setup`,
    };
    patch.characters = [
      {
        name: roleA,
        role: roleA,
        personality: [],
        goals: [],
        conflicts: [],
        notes: ["setup role"],
        avoid: [],
      },
      {
        name: roleB,
        role: roleB,
        personality: [],
        goals: [],
        conflicts: [],
        notes: ["setup role"],
        avoid: [],
      },
    ];
    return {
      matched: true,
      kind: "role_pair_setup",
      confidence: "high",
      matchedSignals: ["role_pair_setup"],
      patch,
      entities: {
        characterNames: [roleA, roleB],
        roles: [roleA, roleB],
        relationshipTypes: [],
      },
    };
  }

  // "hero doctor hai" / "heroine student hai"
  const occupation = text.match(
    /\b(hero|heroine|male\s+lead|female\s+lead|protagonist)\s+([A-Za-z][A-Za-z'-]{1,24})\s+hai\b/i
  );
  if (occupation) {
    const leadRole = occupation[1].toLowerCase().replace(/\s+/g, " ");
    const job = titleCaseRole(occupation[2]);
    const patch = emptyPatch();
    const displayName = job;
    patch.characters = [
      {
        name: displayName,
        role: `${leadRole} · ${job}`,
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
    ];
    return {
      matched: true,
      kind: "occupation_role",
      confidence: "high",
      matchedSignals: ["occupation_role"],
      patch,
      entities: {
        characterNames: [displayName],
        roles: [leadRole, job],
        relationshipTypes: [],
      },
    };
  }

  const facts = extractMemoryFacts(text, memory);
  if (!facts.matched) {
    return {
      matched: false,
      kind: "none",
      confidence: "medium",
      matchedSignals: [],
      patch: emptyPatch(),
      entities: { characterNames: [], roles: [], relationshipTypes: [] },
    };
  }

  let kind: DeterministicParseKind = "character_role";
  if (facts.matchedSignals.some((s) => s.startsWith("relationship"))) {
    kind = "relationship";
  } else if (
    facts.matchedSignals.some((s) =>
      ["personality_add", "personality_avoid", "trait_negation", "character_note"].includes(
        s
      )
    ) &&
    !facts.matchedSignals.includes("role_assignment")
  ) {
    kind = "character_trait";
  }

  return {
    matched: true,
    kind,
    confidence: facts.confidence,
    matchedSignals: facts.matchedSignals,
    patch: facts.patch,
    entities: entitiesFromPatch(facts.patch),
  };
}

export function confirmReplyFromParse(
  parsed: DeterministicParseResult
): string {
  if (!parsed.matched) return "";
  if (parsed.kind === "role_pair_setup" && parsed.entities.roles.length >= 2) {
    const [a, b] = parsed.entities.roles;
    return `Got it ✨ Story ka setup ${a} aur ${b} ke around hoga. In dono ka connection ya central conflict batao, ya main options suggest karun?`;
  }
  if (parsed.kind === "occupation_role" && parsed.entities.roles.length >= 1) {
    const label = parsed.entities.roles.join(" · ");
    return `Got it ❤️ ${label} note kar liya. Character ka naam ya unka conflict batao?`;
  }
  return buildMemoryConfirmReply(parsed.patch);
}
