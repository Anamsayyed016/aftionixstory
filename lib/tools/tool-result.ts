/**
 * ToolResult helpers (Phase G).
 */

import type { MemoryV2Patch } from "@/lib/story-memory/v2/patch";
import type { ToolId, ToolResult } from "@/lib/tools/schemas";

export function okToolResult(partial: {
  toolId: ToolId;
  summary: string;
  patch?: MemoryV2Patch;
  updatedEntities?: ToolResult["updatedEntities"];
  warnings?: string[];
  data?: unknown;
  durationMs?: number;
}): ToolResult {
  const entities = partial.updatedEntities ?? [];
  return {
    success: true,
    toolId: partial.toolId,
    patch: partial.patch,
    updatedEntities: entities,
    warnings: partial.warnings ?? [],
    errors: [],
    summary: partial.summary,
    executionMetadata: {
      durationMs: partial.durationMs ?? 0,
      entityCount: entities.length,
    },
    data: partial.data,
  };
}

export function failToolResult(partial: {
  toolId?: ToolId;
  summary: string;
  errors: string[];
  warnings?: string[];
  durationMs?: number;
}): ToolResult {
  return {
    success: false,
    toolId: partial.toolId,
    updatedEntities: [],
    warnings: partial.warnings ?? [],
    errors: partial.errors,
    summary: partial.summary,
    executionMetadata: {
      durationMs: partial.durationMs ?? 0,
      entityCount: 0,
    },
  };
}
