/**
 * Story core + writing rules + preferences tools (Phase G).
 */

import { z } from "zod";
import type { StoryToolDefinition } from "@/lib/tools/types";
import { okToolResult, failToolResult } from "@/lib/tools/tool-result";

export const storyRenameTool: StoryToolDefinition<{ title: string }> = {
  id: "story.rename",
  version: "1.0.0",
  description: "Rename the story",
  inputSchema: z.object({ title: z.string().trim().min(1).max(200) }),
  validator: z.object({ title: z.string().trim().min(1).max(200) }),
  metadata: { category: "story", mutates: true, idempotent: true },
  executor(input) {
    return okToolResult({
      toolId: "story.rename",
      summary: `Story title set to ${input.title}`,
      patch: { set: { title: input.title } } as never,
      updatedEntities: [{ type: "story", name: input.title }],
    });
  },
};

export const storyConceptTool: StoryToolDefinition<{ concept: string }> = {
  id: "story.concept",
  version: "1.0.0",
  description: "Update story concept",
  inputSchema: z.object({ concept: z.string().trim().min(1).max(4000) }),
  validator: z.object({ concept: z.string().trim().min(1).max(4000) }),
  metadata: { category: "story", mutates: true, idempotent: true },
  executor(input) {
    return okToolResult({
      toolId: "story.concept",
      summary: "Updated story concept",
      patch: { set: { concept: input.concept } } as never,
      updatedEntities: [{ type: "story" }],
    });
  },
};

export const storyGenreTool: StoryToolDefinition<{ genre: string[] | string }> = {
  id: "story.genre",
  version: "1.0.0",
  description: "Update story genre",
  inputSchema: z.object({
    genre: z.union([z.string().trim().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  validator: z.object({
    genre: z.union([z.string().trim().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  metadata: { category: "story", mutates: true, idempotent: true },
  executor(input) {
    const genre = Array.isArray(input.genre) ? input.genre : [input.genre];
    return okToolResult({
      toolId: "story.genre",
      summary: `Genre set to ${genre.join(", ")}`,
      patch: { set: { genre } } as never,
      updatedEntities: [{ type: "story" }],
    });
  },
};

export const storyToneTool: StoryToolDefinition<{ tone: string[] | string }> = {
  id: "story.tone",
  version: "1.0.0",
  description: "Update story tone",
  inputSchema: z.object({
    tone: z.union([z.string().trim().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  validator: z.object({
    tone: z.union([z.string().trim().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  metadata: { category: "story", mutates: true, idempotent: true },
  executor(input) {
    const tone = Array.isArray(input.tone) ? input.tone : [input.tone];
    return okToolResult({
      toolId: "story.tone",
      summary: `Tone set to ${tone.join(", ")}`,
      patch: { set: { tone } } as never,
      updatedEntities: [{ type: "story" }],
    });
  },
};

const ruleInput = z.object({
  rule: z.string().trim().min(1).max(500),
  ruleId: z.string().optional(),
});

export const writingRulesAddTool: StoryToolDefinition<z.infer<typeof ruleInput>> = {
  id: "writing_rules.add",
  version: "1.0.0",
  description: "Add a writing rule",
  inputSchema: ruleInput,
  validator: ruleInput,
  metadata: { category: "writing_rules", mutates: true },
  executor(input) {
    return okToolResult({
      toolId: "writing_rules.add",
      summary: "Added writing rule",
      patch: {
        upsertWritingRules: [{ rule: input.rule }],
      } as never,
      updatedEntities: [{ type: "writing_rule", name: input.rule.slice(0, 40) }],
    });
  },
};

export const writingRulesUpdateTool: StoryToolDefinition<z.infer<typeof ruleInput>> = {
  id: "writing_rules.update",
  version: "1.0.0",
  description: "Update a writing rule",
  inputSchema: ruleInput,
  validator: ruleInput,
  metadata: { category: "writing_rules", mutates: true, idempotent: true },
  executor(input, ctx) {
    const existing =
      (input.ruleId &&
        ctx.repository
          .getMemory()
          .writingRules.find((r) => r.id === input.ruleId)) ||
      ctx.repository
        .getMemory()
        .writingRules.find((r) => r.rule === input.rule);
    if (!existing && !input.ruleId) {
      return okToolResult({
        toolId: "writing_rules.update",
        summary: "Upserted writing rule",
        patch: {
          upsertWritingRules: [{ rule: input.rule }],
        } as never,
        updatedEntities: [{ type: "writing_rule" }],
      });
    }
    if (!existing) {
      return failToolResult({
        toolId: "writing_rules.update",
        summary: "Writing rule not found",
        errors: ["Writing rule not found"],
      });
    }
    return okToolResult({
      toolId: "writing_rules.update",
      summary: "Updated writing rule",
      patch: {
        upsertWritingRules: [{ id: existing.id, rule: input.rule }],
        allowConflicts: true,
      } as never,
      updatedEntities: [{ type: "writing_rule", id: existing.id }],
    });
  },
};

export const writingRulesRemoveTool: StoryToolDefinition<z.infer<typeof ruleInput>> = {
  id: "writing_rules.remove",
  version: "1.0.0",
  description: "Remove a writing rule",
  inputSchema: ruleInput,
  validator: ruleInput,
  metadata: { category: "writing_rules", mutates: true },
  executor(input, ctx) {
    const existing =
      (input.ruleId &&
        ctx.repository
          .getMemory()
          .writingRules.find((r) => r.id === input.ruleId)) ||
      ctx.repository
        .getMemory()
        .writingRules.find((r) => r.rule === input.rule);
    if (!existing) {
      return failToolResult({
        toolId: "writing_rules.remove",
        summary: "Writing rule not found",
        errors: ["Writing rule not found"],
      });
    }
    return okToolResult({
      toolId: "writing_rules.remove",
      summary: "Removed writing rule",
      patch: {
        remove: [{ type: "writing_rule", id: existing.id, rule: existing.rule }],
      } as never,
      updatedEntities: [{ type: "writing_rule", id: existing.id }],
    });
  },
};

export const preferencesLanguageTool: StoryToolDefinition<{ language: string }> = {
  id: "preferences.language",
  version: "1.0.0",
  description: "Set preferred language",
  inputSchema: z.object({ language: z.string().trim().min(1).max(40) }),
  validator: z.object({ language: z.string().trim().min(1).max(40) }),
  metadata: { category: "preferences", mutates: true, idempotent: true },
  executor(input) {
    return okToolResult({
      toolId: "preferences.language",
      summary: `Language preference: ${input.language}`,
      patch: {
        updatePreferences: { language: input.language },
      } as never,
      updatedEntities: [{ type: "preference", name: "language" }],
    });
  },
};

export const preferencesToneTool: StoryToolDefinition<{ tone: string }> = {
  id: "preferences.tone",
  version: "1.0.0",
  description: "Set preferred tone",
  inputSchema: z.object({ tone: z.string().trim().min(1).max(80) }),
  validator: z.object({ tone: z.string().trim().min(1).max(80) }),
  metadata: { category: "preferences", mutates: true, idempotent: true },
  executor(input) {
    return okToolResult({
      toolId: "preferences.tone",
      summary: `Tone preference: ${input.tone}`,
      patch: {
        updatePreferences: { tone: [input.tone] },
      } as never,
      updatedEntities: [{ type: "preference", name: "tone" }],
    });
  },
};

export const preferencesPacingTool: StoryToolDefinition<{ pacing: string }> = {
  id: "preferences.pacing",
  version: "1.0.0",
  description: "Set preferred pacing",
  inputSchema: z.object({ pacing: z.string().trim().min(1).max(40) }),
  validator: z.object({ pacing: z.string().trim().min(1).max(40) }),
  metadata: { category: "preferences", mutates: true, idempotent: true },
  executor(input) {
    return okToolResult({
      toolId: "preferences.pacing",
      summary: `Pacing preference: ${input.pacing}`,
      patch: {
        updatePreferences: { pacing: input.pacing },
      } as never,
      updatedEntities: [{ type: "preference", name: "pacing" }],
    });
  },
};

export const preferencesStyleTool: StoryToolDefinition<{ style: string }> = {
  id: "preferences.style",
  version: "1.0.0",
  description: "Set preferred writing style",
  inputSchema: z.object({ style: z.string().trim().min(1).max(80) }),
  validator: z.object({ style: z.string().trim().min(1).max(80) }),
  metadata: { category: "preferences", mutates: true, idempotent: true },
  executor(input) {
    return okToolResult({
      toolId: "preferences.style",
      summary: `Style preference: ${input.style}`,
      patch: {
        updatePreferences: { narrationStyle: input.style },
      } as never,
      updatedEntities: [{ type: "preference", name: "style" }],
    });
  },
};

export const storyTools = [
  storyRenameTool,
  storyConceptTool,
  storyGenreTool,
  storyToneTool,
];

export const writingRulesTools = [
  writingRulesAddTool,
  writingRulesUpdateTool,
  writingRulesRemoveTool,
];

export const preferencesTools = [
  preferencesLanguageTool,
  preferencesToneTool,
  preferencesPacingTool,
  preferencesStyleTool,
];
