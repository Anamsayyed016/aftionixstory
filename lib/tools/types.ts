/**
 * Story Tool Framework types (Phase G).
 * Providers never execute tools; tools never call providers.
 */

import type { z } from "zod";
import type { StoryMemoryRepository } from "@/lib/story-memory/v2/repository";
import type { MemoryV2Patch } from "@/lib/story-memory/v2/patch";
import type { ToolId, ToolRequest, ToolResult } from "@/lib/tools/schemas";

export type { ToolId, ToolRequest, ToolResult };

export type ToolExecutionContext = {
  repository: StoryMemoryRepository;
  conversationId?: string | null;
  /** Must match conversationId when both set — prevents cross-conversation mutation */
  expectedConversationId?: string | null;
};

export type ToolMetadata = {
  category:
    | "character"
    | "relationship"
    | "location"
    | "timeline"
    | "story"
    | "writing_rules"
    | "preferences"
    | "search"
    | "validation";
  mutates: boolean;
  idempotent?: boolean;
};

/** Heterogeneous tool catalog; each tool validates input with its own Zod schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional for registry variance
export type StoryToolDefinition<TInput = any> = {
  id: ToolId;
  version: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  /** Optional output shape documentation (runtime uses ToolResult) */
  outputSchema?: z.ZodType<unknown>;
  validator: z.ZodType<TInput>;
  executor: (
    input: TInput,
    ctx: ToolExecutionContext
  ) => ToolResult | Promise<ToolResult>;
  metadata: ToolMetadata;
};

export type ToolPlan = {
  requiresTools: boolean;
  needsAiPlanner: boolean;
  requests: ToolRequest[];
  reason: string;
};

export type ToolBatchResult = {
  success: boolean;
  results: ToolResult[];
  /** Merged patches applied (empty on rollback) */
  appliedPatches: MemoryV2Patch[];
  warnings: string[];
  errors: string[];
  summary: string;
  executionMetadata: {
    durationMs: number;
    entityCount: number;
    toolCount: number;
    rolledBack: boolean;
  };
};
