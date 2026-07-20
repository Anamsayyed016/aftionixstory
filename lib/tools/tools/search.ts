/**
 * Search + validation tools (Phase G) — read-only / non-provider.
 */

import { z } from "zod";
import { normalizeName } from "@/lib/story-memory/v2/normalize";
import type { StoryToolDefinition } from "@/lib/tools/types";
import { okToolResult, failToolResult } from "@/lib/tools/tool-result";

const queryInput = z.object({
  query: z.string().trim().min(1).max(500),
});

export const searchCharacterTool: StoryToolDefinition<z.infer<typeof queryInput>> = {
  id: "search.character",
  version: "1.0.0",
  description: "Search characters in memory",
  inputSchema: queryInput,
  validator: queryInput,
  metadata: { category: "search", mutates: false, idempotent: true },
  executor(input, ctx) {
    const q = normalizeName(input.query);
    const hits = ctx.repository.getMemory().characters.filter((c) => {
      const blob = normalizeName(
        [c.name, ...c.aliases, c.role || "", c.occupation || ""].join(" ")
      );
      return blob.includes(q) || q.includes(normalizeName(c.name));
    });
    return okToolResult({
      toolId: "search.character",
      summary:
        hits.length === 0
          ? "No characters matched"
          : `Found ${hits.length} character(s)`,
      updatedEntities: hits.map((c) => ({
        type: "character",
        id: c.id,
        name: c.name,
      })),
      data: {
        characters: hits.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          status: c.status,
        })),
      },
    });
  },
};

export const searchRelationshipTool: StoryToolDefinition<
  z.infer<typeof queryInput>
> = {
  id: "search.relationship",
  version: "1.0.0",
  description: "Search relationships in memory",
  inputSchema: queryInput,
  validator: queryInput,
  metadata: { category: "search", mutates: false, idempotent: true },
  executor(input, ctx) {
    const memory = ctx.repository.getMemory();
    const q = normalizeName(input.query);
    const nameById = new Map(memory.characters.map((c) => [c.id, c.name]));
    const hits = memory.relationships.filter((r) => {
      const from = nameById.get(r.fromCharacterId) || "";
      const to = nameById.get(r.toCharacterId) || "";
      const blob = normalizeName([from, to, r.type, r.label || ""].join(" "));
      return blob.includes(q) || q.includes(normalizeName(r.type));
    });
    return okToolResult({
      toolId: "search.relationship",
      summary:
        hits.length === 0
          ? "No relationships matched"
          : `Found ${hits.length} relationship(s)`,
      updatedEntities: hits.map((r) => ({ type: "relationship", id: r.id })),
      data: {
        relationships: hits.map((r) => ({
          id: r.id,
          type: r.type,
          from: nameById.get(r.fromCharacterId),
          to: nameById.get(r.toCharacterId),
          status: r.status,
        })),
      },
    });
  },
};

export const searchEventsTool: StoryToolDefinition<z.infer<typeof queryInput>> = {
  id: "search.events",
  version: "1.0.0",
  description: "Search events in memory",
  inputSchema: queryInput,
  validator: queryInput,
  metadata: { category: "search", mutates: false, idempotent: true },
  executor(input, ctx) {
    const q = normalizeName(input.query);
    const hits = ctx.repository.getMemory().events.filter((e) => {
      const blob = normalizeName(
        [e.title, e.description || "", ...(e.causes || []), ...(e.consequences || [])].join(
          " "
        )
      );
      return blob.includes(q);
    });
    return okToolResult({
      toolId: "search.events",
      summary:
        hits.length === 0 ? "No events matched" : `Found ${hits.length} event(s)`,
      updatedEntities: hits.map((e) => ({
        type: "event",
        id: e.id,
        name: e.title,
      })),
      data: {
        events: hits.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
        })),
      },
    });
  },
};

export const searchTimelineTool: StoryToolDefinition<z.infer<typeof queryInput>> = {
  id: "search.timeline",
  version: "1.0.0",
  description: "Search timeline entries",
  inputSchema: queryInput,
  validator: queryInput,
  metadata: { category: "search", mutates: false, idempotent: true },
  executor(input, ctx) {
    const q = normalizeName(input.query);
    const hits = ctx.repository.getMemory().timeline.filter((t) => {
      const blob = normalizeName(
        [t.label, ...(t.notes || [])].join(" ")
      );
      return blob.includes(q) || q.length < 3;
    });
    const ordered = [...hits].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)
    );
    return okToolResult({
      toolId: "search.timeline",
      summary:
        ordered.length === 0
          ? "No timeline entries matched"
          : `Found ${ordered.length} timeline entr(y/ies)`,
      updatedEntities: ordered.map((t) => ({
        type: "timeline",
        id: t.id,
        name: t.label,
      })),
      data: {
        timeline: ordered.map((t) => ({
          id: t.id,
          label: t.label,
          sequence: t.sequence,
        })),
      },
    });
  },
};

export const validationContinuityTool: StoryToolDefinition<Record<string, never>> = {
  id: "validation.continuity",
  version: "1.0.0",
  description: "Validate memory continuity issues",
  inputSchema: z.object({}),
  validator: z.object({}),
  metadata: { category: "validation", mutates: false, idempotent: true },
  executor(_input, ctx) {
    const report = ctx.repository.validateMemory();
    return okToolResult({
      toolId: "validation.continuity",
      summary: report.ok
        ? "Continuity checks passed"
        : `Found ${report.issues.length} continuity issue(s)`,
      warnings: report.issues,
      data: { ok: report.ok, issues: report.issues },
    });
  },
};

export const validationDuplicateCharactersTool: StoryToolDefinition<
  Record<string, never>
> = {
  id: "validation.duplicate_characters",
  version: "1.0.0",
  description: "Detect duplicate character names/aliases",
  inputSchema: z.object({}),
  validator: z.object({}),
  metadata: { category: "validation", mutates: false, idempotent: true },
  executor(_input, ctx) {
    const chars = ctx.repository.getMemory().characters.filter(
      (c) => c.status !== "archived"
    );
    const buckets = new Map<string, string[]>();
    for (const c of chars) {
      const keys = [c.name, ...c.aliases].map(normalizeName).filter(Boolean);
      for (const key of keys) {
        const list = buckets.get(key) || [];
        if (!list.includes(c.id)) list.push(c.id);
        buckets.set(key, list);
      }
    }
    const duplicates = [...buckets.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => ({ key, ids }));
    return okToolResult({
      toolId: "validation.duplicate_characters",
      summary:
        duplicates.length === 0
          ? "No duplicate characters"
          : `Found ${duplicates.length} duplicate name cluster(s)`,
      warnings: duplicates.map(
        (d) => `Duplicate key "${d.key}" across ${d.ids.length} characters`
      ),
      data: { duplicates },
    });
  },
};

export const validationRelationshipTool: StoryToolDefinition<
  Record<string, never>
> = {
  id: "validation.relationship",
  version: "1.0.0",
  description: "Validate relationship endpoints exist",
  inputSchema: z.object({}),
  validator: z.object({}),
  metadata: { category: "validation", mutates: false, idempotent: true },
  executor(_input, ctx) {
    const memory = ctx.repository.getMemory();
    const ids = new Set(memory.characters.map((c) => c.id));
    const issues: string[] = [];
    for (const r of memory.relationships) {
      if (!ids.has(r.fromCharacterId)) {
        issues.push(`Relationship ${r.id} missing fromCharacterId`);
      }
      if (!ids.has(r.toCharacterId)) {
        issues.push(`Relationship ${r.id} missing toCharacterId`);
      }
      if (r.fromCharacterId === r.toCharacterId) {
        issues.push(`Relationship ${r.id} is self-referential`);
      }
    }
    if (issues.length) {
      return failToolResult({
        toolId: "validation.relationship",
        summary: `Found ${issues.length} relationship issue(s)`,
        errors: issues,
        warnings: issues,
      });
    }
    return okToolResult({
      toolId: "validation.relationship",
      summary: "Relationships valid",
      data: { ok: true, issues: [] },
    });
  },
};

export const searchTools = [
  searchCharacterTool,
  searchRelationshipTool,
  searchEventsTool,
  searchTimelineTool,
];

export const validationTools = [
  validationContinuityTool,
  validationDuplicateCharactersTool,
  validationRelationshipTool,
];
