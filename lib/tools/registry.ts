import { createBuiltinTools } from "@/lib/tools/tools";
import type {
  StoryToolDefinition,
  ToolExecutionContext,
} from "@/lib/tools/types";
import type { ToolId, ToolRequest, ToolResult } from "@/lib/tools/schemas";
import { toolRequestSchema } from "@/lib/tools/schemas";
import { failToolResult } from "@/lib/tools/tool-result";
import { logAiEvent } from "@/lib/ai/logger";

export class StoryToolRegistry {
  private readonly tools = new Map<ToolId, StoryToolDefinition>();

  register(tool: StoryToolDefinition): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }
    this.tools.set(tool.id, tool);
  }

  /** Test helper — replace or add without throwing */
  registerOrReplace(tool: StoryToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  lookup(toolId: ToolId | string): StoryToolDefinition | null {
    return this.tools.get(toolId as ToolId) ?? null;
  }

  list(): StoryToolDefinition[] {
    return [...this.tools.values()];
  }

  validate(request: unknown): {
    ok: true;
    request: ToolRequest;
    tool: StoryToolDefinition;
    input: unknown;
  } | {
    ok: false;
    errors: string[];
  } {
    const parsed = toolRequestSchema.safeParse(request);
    if (!parsed.success) {
      return {
        ok: false,
        errors: parsed.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`
        ),
      };
    }
    const tool = this.lookup(parsed.data.toolId);
    if (!tool) {
      return { ok: false, errors: [`Unknown tool: ${parsed.data.toolId}`] };
    }
    const input = tool.validator.safeParse(parsed.data.arguments);
    if (!input.success) {
      return {
        ok: false,
        errors: input.error.issues.map(
          (i) => `${i.path.join(".") || "arguments"}: ${i.message}`
        ),
      };
    }
    return {
      ok: true,
      request: parsed.data,
      tool,
      input: input.data,
    };
  }

  async execute(
    request: unknown,
    ctx: ToolExecutionContext
  ): Promise<ToolResult> {
    const started = Date.now();
    const validated = this.validate(request);
    if (!validated.ok) {
      return failToolResult({
        summary: "Invalid tool request",
        errors: validated.errors,
        durationMs: Date.now() - started,
      });
    }

    if (
      ctx.expectedConversationId &&
      ctx.conversationId &&
      ctx.expectedConversationId !== ctx.conversationId
    ) {
      return failToolResult({
        toolId: validated.request.toolId,
        summary: "Permission denied",
        errors: ["Tools cannot modify unrelated conversations"],
        durationMs: Date.now() - started,
      });
    }

    try {
      const result = await validated.tool.executor(
        validated.input as never,
        ctx
      );
      const durationMs = Date.now() - started;
      logAiEvent("info", "story_tools.execute", {
        toolId: validated.request.toolId,
        durationMs,
        success: result.success,
        entityCount: result.executionMetadata?.entityCount ?? 0,
        warningCount: result.warnings?.length ?? 0,
      });
      return {
        ...result,
        toolId: validated.request.toolId,
        executionMetadata: {
          ...result.executionMetadata,
          durationMs,
          entityCount:
            result.executionMetadata?.entityCount ??
            result.updatedEntities?.length ??
            0,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - started;
      logAiEvent("warn", "story_tools.execute", {
        toolId: validated.request.toolId,
        durationMs,
        success: false,
        entityCount: 0,
        warningCount: 0,
        code: "TOOL_EXECUTOR_THREW",
      });
      return failToolResult({
        toolId: validated.request.toolId,
        summary: "Tool execution failed",
        errors: [error instanceof Error ? error.message : "unknown_error"],
        durationMs,
      });
    }
  }

  clear(): void {
    this.tools.clear();
  }
}

let defaultRegistry: StoryToolRegistry | null = null;

export function createStoryToolRegistry(
  tools: StoryToolDefinition[] = []
): StoryToolRegistry {
  const registry = new StoryToolRegistry();
  for (const tool of tools) {
    registry.register(tool);
  }
  return registry;
}

export function getDefaultStoryToolRegistry(): StoryToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createStoryToolRegistry(createBuiltinTools());
  }
  return defaultRegistry;
}

/** Test-only */
export function __resetDefaultStoryToolRegistryForTests(): void {
  defaultRegistry = null;
}

export function __setDefaultStoryToolRegistryForTests(
  registry: StoryToolRegistry | null
): void {
  defaultRegistry = registry;
}
