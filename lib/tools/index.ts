/**
 * Story Tool Framework — public exports (Phase G).
 */

export { isStoryToolFrameworkEnabled } from "@/lib/tools/feature-flag";
export {
  TOOL_IDS,
  toolIdSchema,
  toolRequestSchema,
  toolResultSchema,
  type ToolId,
  type ToolRequest,
  type ToolResult,
} from "@/lib/tools/schemas";
export type {
  StoryToolDefinition,
  ToolBatchResult,
  ToolExecutionContext,
  ToolMetadata,
  ToolPlan,
} from "@/lib/tools/types";
export {
  parseToolRequest,
  parseToolRequests,
  parseToolRequestsFromText,
  safeParseToolRequestsFromText,
} from "@/lib/tools/tool-request";
export { okToolResult, failToolResult } from "@/lib/tools/tool-result";
export {
  StoryToolRegistry,
  createStoryToolRegistry,
  getDefaultStoryToolRegistry,
  __resetDefaultStoryToolRegistryForTests,
  __setDefaultStoryToolRegistryForTests,
} from "@/lib/tools/registry";
export { executeToolRequests } from "@/lib/tools/executor";
export {
  planStoryTools,
  intentRequiresTools,
  type PlanStoryToolsInput,
} from "@/lib/tools/planner";
export { createBuiltinTools } from "@/lib/tools/tools";
export { runToolFrameworkTurn } from "@/lib/tools/brain-adapter";
