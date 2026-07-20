/**
 * Tool Planner — decides whether a turn needs deterministic tools (Phase G).
 * Creative generation never routes through tools.
 */

import type { StoryIntent } from "@/lib/conversation-brain/intents";
import { isCreativeStoryIntent } from "@/lib/conversation-brain/intents";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import type { ToolPlan } from "@/lib/tools/types";
import type { ToolRequest } from "@/lib/tools/schemas";
import { ConversationStateMemoryRepository } from "@/lib/story-memory/v2/repository";

const TOOL_INTENTS = new Set<StoryIntent>([
  "create_character",
  "update_character",
  "create_relationship",
  "update_relationship",
  "create_location",
  "update_location",
  "memory_update",
  "memory_correction",
  "memory_delete",
  "language_change",
  "style_change",
  "tone_change",
  "pacing_change",
  "pov_change",
  "emoji_preference",
  "search_story",
  "character_question",
  "relationship_question",
  "story_question",
  "episode_question",
]);

const SEARCH_INTENTS = new Set<StoryIntent>([
  "search_story",
  "character_question",
  "relationship_question",
  "story_question",
  "episode_question",
]);

export function intentRequiresTools(intent: string | null | undefined): boolean {
  if (!intent) return false;
  if (isCreativeStoryIntent(intent as StoryIntent)) return false;
  return TOOL_INTENTS.has(intent as StoryIntent);
}

function tryParseRename(userMessage: string): ToolRequest | null {
  const text = userMessage.trim();
  const patterns = [
    /(?:rename|renaming)\s+["']?([A-Za-z][\w'-]*)["']?\s+(?:to|as)\s+["']?([A-Za-z][\w'-]*)["']?/i,
    /(?:change|update)\s+["']?([A-Za-z][\w'-]*)["']?\s*(?:'s)?\s*name\s+to\s+["']?([A-Za-z][\w'-]*)["']?/i,
    /["']?([A-Za-z][\w'-]*)["']?\s+(?:is now|should be called|ko)\s+["']?([A-Za-z][\w'-]*)["']?/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m?.[2] && m[1].toLowerCase() !== m[2].toLowerCase()) {
      return {
        toolId: "character.rename",
        arguments: { oldName: m[1], newName: m[2] },
        reason: "User explicitly requested rename",
        confidence: 0.99,
      };
    }
  }
  return null;
}

function tryParseRelationship(userMessage: string): ToolRequest | null {
  const m = userMessage.match(
    /([A-Za-z][\w'-]*)\s+(?:and|&)\s+([A-Za-z][\w'-]*)\s+(?:are|is)\s+([\w\s-]{2,40}?)(?:\.|$)/i
  );
  if (!m) return null;
  return {
    toolId: "relationship.create",
    arguments: {
      fromName: m[1],
      toName: m[2],
      type: m[3].trim().toLowerCase(),
    },
    reason: "User stated a relationship",
    confidence: 0.85,
  };
}

function tryParsePreference(
  intent: string,
  userMessage: string
): ToolRequest | null {
  const lower = userMessage.toLowerCase();
  if (intent === "language_change") {
    const lang =
      lower.includes("urdu") || lower.includes("hindi")
        ? lower.includes("urdu")
          ? "urdu"
          : "hindi"
        : lower.includes("english")
          ? "english"
          : null;
    if (lang) {
      return {
        toolId: "preferences.language",
        arguments: { language: lang },
        reason: "User requested language preference",
        confidence: 0.95,
      };
    }
  }
  if (intent === "tone_change") {
    const toneMatch = userMessage.match(
      /(?:tone|mood)\s+(?:to|as|should be)?\s*["']?([\w\s-]{2,40})["']?/i
    );
    if (toneMatch?.[1]) {
      return {
        toolId: "preferences.tone",
        arguments: { tone: toneMatch[1].trim() },
        reason: "User requested tone preference",
        confidence: 0.9,
      };
    }
  }
  if (intent === "pacing_change") {
    const pace =
      lower.includes("slow")
        ? "slow"
        : lower.includes("fast")
          ? "fast"
          : lower.includes("medium")
            ? "medium"
            : null;
    if (pace) {
      return {
        toolId: "preferences.pacing",
        arguments: { pacing: pace },
        reason: "User requested pacing preference",
        confidence: 0.9,
      };
    }
  }
  if (intent === "style_change") {
    const styleMatch = userMessage.match(
      /(?:style|writing style)\s+(?:to|as)?\s*["']?([\w\s-]{2,40})["']?/i
    );
    if (styleMatch?.[1]) {
      return {
        toolId: "preferences.style",
        arguments: { style: styleMatch[1].trim() },
        reason: "User requested style preference",
        confidence: 0.9,
      };
    }
  }
  return null;
}

function tryParseSearch(
  intent: string,
  userMessage: string,
  memory: StoryMemory
): ToolRequest | null {
  if (!SEARCH_INTENTS.has(intent as StoryIntent)) return null;
  const repo = new ConversationStateMemoryRepository(getMemoryV2(memory));
  const names = repo.getMemory().characters.map((c) => c.name);
  const mentioned = names.find((n) =>
    userMessage.toLowerCase().includes(n.toLowerCase())
  );
  if (intent === "character_question" || /who is|tell me about/i.test(userMessage)) {
    return {
      toolId: "search.character",
      arguments: { query: mentioned || userMessage },
      reason: "User asked about a character",
      confidence: 0.8,
    };
  }
  if (intent === "relationship_question") {
    return {
      toolId: "search.relationship",
      arguments: { query: userMessage },
      reason: "User asked about a relationship",
      confidence: 0.8,
    };
  }
  if (/timeline|event|what happened/i.test(userMessage)) {
    return {
      toolId: "search.timeline",
      arguments: { query: userMessage },
      reason: "User asked about timeline",
      confidence: 0.75,
    };
  }
  return {
    toolId: "search.character",
    arguments: { query: userMessage },
    reason: "Story search",
    confidence: 0.6,
  };
}

export type PlanStoryToolsInput = {
  intent: string;
  userMessage: string;
  memory: StoryMemory;
  entities?: { characterNames?: string[] };
};

/**
 * Plan tools for a turn. Deterministic requests when patterns match;
 * otherwise marks needsAiPlanner for mutation intents.
 */
export function planStoryTools(input: PlanStoryToolsInput): ToolPlan {
  const intent = input.intent;

  if (isCreativeStoryIntent(intent as StoryIntent)) {
    return {
      requiresTools: false,
      needsAiPlanner: false,
      requests: [],
      reason: "Creative generation does not use tools",
    };
  }

  if (!intentRequiresTools(intent)) {
    return {
      requiresTools: false,
      needsAiPlanner: false,
      requests: [],
      reason: "Intent does not require tools",
    };
  }

  const requests: ToolRequest[] = [];

  const rename = tryParseRename(input.userMessage);
  if (rename) requests.push(rename);

  if (
    intent === "create_relationship" ||
    intent === "update_relationship" ||
    /relationship|are (friends|enemies|lovers|siblings)/i.test(
      input.userMessage
    )
  ) {
    const rel = tryParseRelationship(input.userMessage);
    if (rel) requests.push(rel);
  }

  const pref = tryParsePreference(intent, input.userMessage);
  if (pref) requests.push(pref);

  if (SEARCH_INTENTS.has(intent as StoryIntent)) {
    const search = tryParseSearch(intent, input.userMessage, input.memory);
    if (search) requests.push(search);
  }

  // Validation tools when correcting / checking duplicates
  if (
    /duplicate|already exist|same name/i.test(input.userMessage) ||
    intent === "memory_correction"
  ) {
    requests.push({
      toolId: "validation.duplicate_characters",
      arguments: {},
      reason: "Validate character uniqueness",
      confidence: 0.7,
    });
  }

  if (requests.length > 0) {
    return {
      requiresTools: true,
      needsAiPlanner: false,
      requests,
      reason: "Deterministic tool plan",
    };
  }

  // Mutation intents without a deterministic parse → AI emits ToolRequest JSON
  return {
    requiresTools: true,
    needsAiPlanner: true,
    requests: [],
    reason: "Needs AI tool planner for ToolRequest JSON",
  };
}
