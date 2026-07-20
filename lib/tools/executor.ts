/**
 * Sequential tool executor with atomic rollback (Phase G).
 */

import { logAiEvent } from "@/lib/ai/logger";
import type { MemoryV2Patch } from "@/lib/story-memory/v2/patch";
import type { StoryMemoryV2 } from "@/lib/story-memory/v2/schema";
import {
  getDefaultStoryToolRegistry,
  type StoryToolRegistry,
} from "@/lib/tools/registry";
import type {
  ToolBatchResult,
  ToolExecutionContext,
} from "@/lib/tools/types";
import type { ToolRequest, ToolResult } from "@/lib/tools/schemas";

function cloneMemory(memory: StoryMemoryV2): StoryMemoryV2 {
  return structuredClone(memory);
}

function restoreRepository(
  ctx: ToolExecutionContext,
  snapshot: StoryMemoryV2
): void {
  const repo = ctx.repository as {
    replaceMemory?: (m: StoryMemoryV2) => void;
    upgradeMemory?: (m: unknown) => StoryMemoryV2;
  };
  if (typeof repo.replaceMemory === "function") {
    repo.replaceMemory(snapshot);
    return;
  }
  if (typeof repo.upgradeMemory === "function") {
    repo.upgradeMemory(snapshot);
  }
}

/**
 * Execute tool requests sequentially. On any failure, roll back all mutations.
 */
export async function executeToolRequests(
  requests: ToolRequest[],
  ctx: ToolExecutionContext,
  options?: { registry?: StoryToolRegistry }
): Promise<ToolBatchResult> {
  const started = Date.now();
  const registry = options?.registry ?? getDefaultStoryToolRegistry();
  const snapshot = cloneMemory(ctx.repository.getMemory());
  const results: ToolResult[] = [];
  const appliedPatches: MemoryV2Patch[] = [];
  const warnings: string[] = [];
  let entityCount = 0;

  if (requests.length === 0) {
    return {
      success: false,
      results: [],
      appliedPatches: [],
      warnings: [],
      errors: ["No tool requests to execute"],
      summary: "No tools",
      executionMetadata: {
        durationMs: Date.now() - started,
        entityCount: 0,
        toolCount: 0,
        rolledBack: false,
      },
    };
  }

  try {
    for (const request of requests) {
      const result = await registry.execute(request, ctx);
      results.push(result);
      if (!result.success) {
        restoreRepository(ctx, snapshot);
        const durationMs = Date.now() - started;
        logAiEvent("warn", "story_tools.batch", {
          toolId: request.toolId,
          durationMs,
          success: false,
          entityCount: 0,
          warningCount: result.warnings.length,
          rolledBack: true,
        });
        return {
          success: false,
          results,
          appliedPatches: [],
          warnings: [...warnings, ...result.warnings],
          errors: result.errors.length
            ? result.errors
            : [`Tool failed: ${request.toolId}`],
          summary: result.summary || `Failed: ${request.toolId}`,
          executionMetadata: {
            durationMs,
            entityCount: 0,
            toolCount: requests.length,
            rolledBack: true,
          },
        };
      }

      if (result.patch) {
        const applied = ctx.repository.applyPatch(result.patch, {
          allowConflicts: Boolean(
            (result.patch as { allowConflicts?: boolean }).allowConflicts
          ),
        });
        if (applied.stale) {
          restoreRepository(ctx, snapshot);
          return {
            success: false,
            results,
            appliedPatches: [],
            warnings: applied.warnings,
            errors: ["Memory revision conflict — rolled back"],
            summary: "Stale memory write",
            executionMetadata: {
              durationMs: Date.now() - started,
              entityCount: 0,
              toolCount: requests.length,
              rolledBack: true,
            },
          };
        }
        appliedPatches.push(result.patch);
        warnings.push(...applied.warnings, ...result.warnings);
      } else {
        warnings.push(...result.warnings);
      }
      entityCount += result.updatedEntities?.length ?? 0;
    }

    const durationMs = Date.now() - started;
    const summary = results.map((r) => r.summary).filter(Boolean).join(" ");
    logAiEvent("info", "story_tools.batch", {
      toolId: requests.map((r) => r.toolId).join(","),
      durationMs,
      success: true,
      entityCount,
      warningCount: warnings.length,
      rolledBack: false,
    });

    return {
      success: true,
      results,
      appliedPatches,
      warnings,
      errors: [],
      summary,
      executionMetadata: {
        durationMs,
        entityCount,
        toolCount: requests.length,
        rolledBack: false,
      },
    };
  } catch (error) {
    restoreRepository(ctx, snapshot);
    const durationMs = Date.now() - started;
    return {
      success: false,
      results,
      appliedPatches: [],
      warnings,
      errors: [error instanceof Error ? error.message : "batch_failed"],
      summary: "Tool batch failed",
      executionMetadata: {
        durationMs,
        entityCount: 0,
        toolCount: requests.length,
        rolledBack: true,
      },
    };
  }
}
