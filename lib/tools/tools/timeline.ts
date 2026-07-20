/**
 * Location + timeline tools (Phase G).
 */

import { z } from "zod";
import type { StoryToolDefinition } from "@/lib/tools/types";
import { failToolResult, okToolResult } from "@/lib/tools/tool-result";

const locationCreate = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().optional(),
  type: z.string().optional(),
});

const locationUpdate = locationCreate.extend({
  locationId: z.string().optional(),
});

const locationRemove = z.object({
  locationId: z.string().optional(),
  name: z.string().optional(),
});

const timelineAdd = z.object({
  label: z.string().trim().min(1).max(200),
  sequence: z.number().int().optional(),
  order: z.number().int().optional(),
  eventId: z.string().optional(),
  notes: z.string().optional(),
});

const timelineUpdate = z.object({
  timelineId: z.string().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  sequence: z.number().int().optional(),
  order: z.number().int().optional(),
  notes: z.string().optional(),
});

const timelineReorder = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const locationCreateTool: StoryToolDefinition<z.infer<typeof locationCreate>> = {
  id: "location.create",
  version: "1.0.0",
  description: "Create a location",
  inputSchema: locationCreate,
  validator: locationCreate,
  metadata: { category: "location", mutates: true },
  executor(input, ctx) {
    if (ctx.repository.findLocationByName(input.name)) {
      return failToolResult({
        toolId: "location.create",
        summary: "Location exists",
        errors: [`Location ${input.name} already exists`],
      });
    }
    return okToolResult({
      toolId: "location.create",
      summary: `Created location ${input.name}`,
      patch: {
        upsertLocations: [
          {
            name: input.name,
            description: input.description ?? null,
            type: input.type ?? null,
          },
        ],
      } as never,
      updatedEntities: [{ type: "location", name: input.name }],
    });
  },
};

export const locationUpdateTool: StoryToolDefinition<z.infer<typeof locationUpdate>> = {
  id: "location.update",
  version: "1.0.0",
  description: "Update a location",
  inputSchema: locationUpdate,
  validator: locationUpdate,
  metadata: { category: "location", mutates: true, idempotent: true },
  executor(input, ctx) {
    const existing =
      (input.locationId &&
        ctx.repository
          .getMemory()
          .locations.find((l) => l.id === input.locationId)) ||
      ctx.repository.findLocationByName(input.name);
    if (!existing) {
      return failToolResult({
        toolId: "location.update",
        summary: "Location not found",
        errors: ["Location not found"],
      });
    }
    return okToolResult({
      toolId: "location.update",
      summary: `Updated location ${existing.name}`,
      patch: {
        upsertLocations: [
          {
            id: existing.id,
            name: input.name || existing.name,
            description: input.description,
            type: input.type,
          },
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "location", id: existing.id, name: existing.name },
      ],
    });
  },
};

export const locationRemoveTool: StoryToolDefinition<z.infer<typeof locationRemove>> = {
  id: "location.remove",
  version: "1.0.0",
  description: "Remove a location",
  inputSchema: locationRemove,
  validator: locationRemove,
  metadata: { category: "location", mutates: true },
  executor(input, ctx) {
    const existing =
      (input.locationId &&
        ctx.repository
          .getMemory()
          .locations.find((l) => l.id === input.locationId)) ||
      (input.name ? ctx.repository.findLocationByName(input.name) : null);
    if (!existing) {
      return failToolResult({
        toolId: "location.remove",
        summary: "Location not found",
        errors: ["Location not found"],
      });
    }
    return okToolResult({
      toolId: "location.remove",
      summary: `Removed location ${existing.name}`,
      patch: {
        remove: [{ type: "location", id: existing.id }],
      } as never,
      updatedEntities: [
        { type: "location", id: existing.id, name: existing.name },
      ],
    });
  },
};

export const timelineAddEventTool: StoryToolDefinition<z.infer<typeof timelineAdd>> = {
  id: "timeline.add_event",
  version: "1.0.0",
  description: "Add a timeline entry",
  inputSchema: timelineAdd,
  validator: timelineAdd,
  metadata: { category: "timeline", mutates: true },
  executor(input) {
    const sequence = input.sequence ?? input.order ?? Date.now();
    return okToolResult({
      toolId: "timeline.add_event",
      summary: `Added timeline: ${input.label}`,
      patch: {
        upsertTimeline: [
          {
            label: input.label,
            sequence,
            eventIds: input.eventId ? [input.eventId] : [],
            notes: input.notes ? [input.notes] : [],
          },
        ],
        upsertEvents: input.eventId
          ? []
          : [
              {
                title: input.label,
                description: input.notes ?? null,
              },
            ],
      } as never,
      updatedEntities: [{ type: "timeline", name: input.label }],
    });
  },
};

export const timelineUpdateTool: StoryToolDefinition<z.infer<typeof timelineUpdate>> = {
  id: "timeline.update",
  version: "1.0.0",
  description: "Update a timeline entry",
  inputSchema: timelineUpdate,
  validator: timelineUpdate,
  metadata: { category: "timeline", mutates: true, idempotent: true },
  executor(input, ctx) {
    const entries = ctx.repository.getMemory().timeline;
    const existing =
      (input.timelineId &&
        entries.find((t) => t.id === input.timelineId)) ||
      (input.label
        ? entries.find(
            (t) => t.label.toLowerCase() === input.label!.toLowerCase()
          )
        : null);
    if (!existing) {
      return failToolResult({
        toolId: "timeline.update",
        summary: "Timeline entry not found",
        errors: ["Timeline entry not found"],
      });
    }
    return okToolResult({
      toolId: "timeline.update",
      summary: `Updated timeline ${existing.label}`,
      patch: {
        upsertTimeline: [
          {
            id: existing.id,
            label: input.label || existing.label,
            sequence: input.sequence ?? input.order ?? existing.sequence,
            notes: input.notes ? [input.notes] : undefined,
          },
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "timeline", id: existing.id, name: existing.label },
      ],
    });
  },
};

export const timelineReorderTool: StoryToolDefinition<
  z.infer<typeof timelineReorder>
> = {
  id: "timeline.reorder",
  version: "1.0.0",
  description: "Reorder timeline entries by id list",
  inputSchema: timelineReorder,
  validator: timelineReorder,
  metadata: { category: "timeline", mutates: true },
  executor(input, ctx) {
    const byId = new Map(
      ctx.repository.getMemory().timeline.map((t) => [t.id, t])
    );
    const missing = input.orderedIds.filter((id) => !byId.has(id));
    if (missing.length) {
      return failToolResult({
        toolId: "timeline.reorder",
        summary: "Unknown timeline ids",
        errors: missing.map((id) => `Unknown timeline id: ${id}`),
      });
    }
    return okToolResult({
      toolId: "timeline.reorder",
      summary: "Reordered timeline",
      patch: {
        upsertTimeline: input.orderedIds.map((id, index) => ({
          id,
          label: byId.get(id)!.label,
          sequence: index + 1,
        })),
        allowConflicts: true,
      } as never,
      updatedEntities: input.orderedIds.map((id) => ({
        type: "timeline",
        id,
      })),
    });
  },
};

export const locationTools = [
  locationCreateTool,
  locationUpdateTool,
  locationRemoveTool,
];

export const timelineTools = [
  timelineAddEventTool,
  timelineUpdateTool,
  timelineReorderTool,
];
