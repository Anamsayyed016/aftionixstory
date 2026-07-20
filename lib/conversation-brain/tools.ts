/**
 * Tool executor stage — Phase 0 stubs + Phase G adapter.
 * AI must not edit the database directly — tools mediate mutations.
 */

import {
  executeToolRequests,
  isStoryToolFrameworkEnabled,
  type ToolRequest,
} from "@/lib/tools";
import { ConversationStateMemoryRepository } from "@/lib/story-memory/v2/repository";
import { emptyStoryMemoryV2 } from "@/lib/story-memory/v2/defaults";

export type BrainToolName =
  | "remember_character"
  | "update_character"
  | "delete_character"
  | "remember_fact"
  | "update_fact"
  | "remember_relationship"
  | "search_memory"
  | "search_story"
  | "search_episode"
  | "search_character"
  | "generate_scene"
  | "generate_episode"
  | "rewrite_scene"
  | "continue_scene"
  | "summarize_story"
  | "extract_story_facts"
  | "save_story"
  | "save_episode";

export type BrainToolCall = {
  name: BrainToolName;
  args: Record<string, unknown>;
};

export type BrainToolResult = {
  name: BrainToolName;
  ok: boolean;
  /** Safe metadata only — never raw secrets or full drafts. */
  code?: string;
  detail?: string;
};

export const BRAIN_TOOL_REGISTRY: ReadonlyArray<{
  name: BrainToolName;
  description: string;
  phase: "0-stub" | "planned" | "g-active";
}> = [
  { name: "remember_character", description: "Persist a character fact", phase: "g-active" },
  { name: "update_character", description: "Update character fields", phase: "g-active" },
  { name: "delete_character", description: "Remove a character", phase: "planned" },
  { name: "remember_fact", description: "Store a story fact", phase: "planned" },
  { name: "update_fact", description: "Update a story fact", phase: "planned" },
  {
    name: "remember_relationship",
    description: "Persist a relationship",
    phase: "g-active",
  },
  { name: "search_memory", description: "Search conversation memory", phase: "g-active" },
  { name: "search_story", description: "Search saved story graph", phase: "planned" },
  { name: "search_episode", description: "Retrieve episode content/summary", phase: "planned" },
  { name: "search_character", description: "Find characters", phase: "g-active" },
  { name: "generate_scene", description: "Generate scene prose", phase: "planned" },
  { name: "generate_episode", description: "Generate episode prose", phase: "planned" },
  { name: "rewrite_scene", description: "Rewrite draft/scene", phase: "planned" },
  { name: "continue_scene", description: "Continue draft/scene", phase: "planned" },
  { name: "summarize_story", description: "Summarize story", phase: "planned" },
  {
    name: "extract_story_facts",
    description: "Extract facts after generation",
    phase: "planned",
  },
  { name: "save_story", description: "Persist story row", phase: "planned" },
  { name: "save_episode", description: "Persist episode row", phase: "planned" },
];

const BRAIN_TO_TOOL: Partial<Record<BrainToolName, ToolRequest["toolId"]>> = {
  remember_character: "character.create",
  update_character: "character.update",
  remember_relationship: "relationship.create",
  search_memory: "search.character",
  search_character: "search.character",
};

/**
 * Execute tool calls. Phase G routes supported names through Story Tool Framework.
 * Unsupported names remain not-implemented (creative generation stays outside tools).
 */
export async function executeBrainTools(
  calls: BrainToolCall[],
  options?: { repository?: ConversationStateMemoryRepository }
): Promise<BrainToolResult[]> {
  if (!isStoryToolFrameworkEnabled() || calls.length === 0) {
    return calls.map((call) => ({
      name: call.name,
      ok: false,
      code: "TOOL_NOT_IMPLEMENTED",
      detail: isStoryToolFrameworkEnabled()
        ? "Empty tool call list"
        : "Phase 0 stub — enable AI_STORY_TOOL_FRAMEWORK_ENABLED",
    }));
  }

  const repository =
    options?.repository ??
    new ConversationStateMemoryRepository(emptyStoryMemoryV2());

  const results: BrainToolResult[] = [];
  for (const call of calls) {
    const toolId = BRAIN_TO_TOOL[call.name];
    if (!toolId) {
      results.push({
        name: call.name,
        ok: false,
        code: "TOOL_NOT_IMPLEMENTED",
        detail: "Not mapped to Story Tool Framework",
      });
      continue;
    }
    const batch = await executeToolRequests(
      [
        {
          toolId,
          arguments: call.args,
          reason: "brain_tool_bridge",
          confidence: 0.8,
        },
      ],
      { repository }
    );
    results.push({
      name: call.name,
      ok: batch.success,
      code: batch.success ? "OK" : "TOOL_FAILED",
      detail: batch.summary.slice(0, 120),
    });
  }
  return results;
}
