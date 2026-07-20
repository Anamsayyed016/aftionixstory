/**
 * Relationship tools (Phase G).
 */

import { z } from "zod";
import type { StoryToolDefinition } from "@/lib/tools/types";
import { failToolResult, okToolResult } from "@/lib/tools/tool-result";

const createInput = z.object({
  fromName: z.string().trim().min(1).optional(),
  toName: z.string().trim().min(1).optional(),
  fromCharacterId: z.string().min(1).optional(),
  toCharacterId: z.string().min(1).optional(),
  type: z.string().trim().min(1).max(100),
  label: z.string().optional(),
  mutual: z.boolean().optional(),
});

const updateInput = createInput.extend({
  relationshipId: z.string().min(1).optional(),
  status: z
    .enum([
      "developing",
      "active",
      "strained",
      "ended",
      "corrected",
      "superseded",
    ])
    .optional(),
});

const removeInput = z.object({
  relationshipId: z.string().min(1).optional(),
  fromName: z.string().optional(),
  toName: z.string().optional(),
  type: z.string().optional(),
});

export const relationshipCreateTool: StoryToolDefinition<
  z.infer<typeof createInput>
> = {
  id: "relationship.create",
  version: "1.0.0",
  description: "Create a relationship between two characters",
  inputSchema: createInput,
  validator: createInput,
  metadata: { category: "relationship", mutates: true },
  executor(input, ctx) {
    const from =
      (input.fromCharacterId &&
        ctx.repository
          .getMemory()
          .characters.find((c) => c.id === input.fromCharacterId)) ||
      (input.fromName
        ? ctx.repository.findCharacterByName(input.fromName)
        : null);
    const to =
      (input.toCharacterId &&
        ctx.repository
          .getMemory()
          .characters.find((c) => c.id === input.toCharacterId)) ||
      (input.toName ? ctx.repository.findCharacterByName(input.toName) : null);

    if (!from || !to) {
      return failToolResult({
        toolId: "relationship.create",
        summary: "Characters required",
        errors: [
          !from ? "from character not found" : "",
          !to ? "to character not found" : "",
        ].filter(Boolean),
      });
    }

    return okToolResult({
      toolId: "relationship.create",
      summary: `Linked ${from.name} → ${to.name} (${input.type})`,
      patch: {
        upsertRelationships: [
          {
            fromCharacterId: from.id,
            toCharacterId: to.id,
            fromName: from.name,
            toName: to.name,
            type: input.type,
            label: input.label ?? null,
            mutual: input.mutual ?? false,
          },
        ],
      } as never,
      updatedEntities: [
        { type: "relationship", name: `${from.name}-${to.name}` },
      ],
    });
  },
};

export const relationshipUpdateTool: StoryToolDefinition<
  z.infer<typeof updateInput>
> = {
  id: "relationship.update",
  version: "1.0.0",
  description: "Update an existing relationship",
  inputSchema: updateInput,
  validator: updateInput,
  metadata: { category: "relationship", mutates: true, idempotent: true },
  executor(input, ctx) {
    const found = ctx.repository.findRelationship({
      fromId: input.fromCharacterId,
      toId: input.toCharacterId,
      fromName: input.fromName,
      toName: input.toName,
      type: input.type,
    });
    const byId = input.relationshipId
      ? ctx.repository
          .getMemory()
          .relationships.find((r) => r.id === input.relationshipId)
      : null;
    const rel = byId || found;
    if (!rel) {
      return failToolResult({
        toolId: "relationship.update",
        summary: "Relationship not found",
        errors: ["Relationship not found"],
      });
    }
    return okToolResult({
      toolId: "relationship.update",
      summary: `Updated relationship ${rel.type}`,
      patch: {
        upsertRelationships: [
          {
            id: rel.id,
            fromCharacterId: rel.fromCharacterId,
            toCharacterId: rel.toCharacterId,
            type: input.type || rel.type,
            label: input.label,
            status: input.status,
            mutual: input.mutual,
            replace: true,
          },
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [{ type: "relationship", id: rel.id }],
    });
  },
};

export const relationshipMergeTool: StoryToolDefinition<
  z.infer<typeof removeInput>
> = {
  id: "relationship.merge",
  version: "1.0.0",
  description: "Mark a relationship as superseded (merge)",
  inputSchema: removeInput,
  validator: removeInput,
  metadata: { category: "relationship", mutates: true },
  executor(input, ctx) {
    const rel =
      (input.relationshipId &&
        ctx.repository
          .getMemory()
          .relationships.find((r) => r.id === input.relationshipId)) ||
      ctx.repository.findRelationship({
        fromName: input.fromName,
        toName: input.toName,
        type: input.type,
      });
    if (!rel) {
      return failToolResult({
        toolId: "relationship.merge",
        summary: "Relationship not found",
        errors: ["Relationship not found"],
      });
    }
    return okToolResult({
      toolId: "relationship.merge",
      summary: "Relationship marked superseded",
      patch: {
        upsertRelationships: [
          {
            id: rel.id,
            fromCharacterId: rel.fromCharacterId,
            toCharacterId: rel.toCharacterId,
            type: rel.type,
            status: "superseded",
            replace: true,
          },
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [{ type: "relationship", id: rel.id }],
    });
  },
};

export const relationshipRemoveTool: StoryToolDefinition<
  z.infer<typeof removeInput>
> = {
  id: "relationship.remove",
  version: "1.0.0",
  description: "Remove a relationship",
  inputSchema: removeInput,
  validator: removeInput,
  metadata: { category: "relationship", mutates: true },
  executor(input, ctx) {
    const rel =
      (input.relationshipId &&
        ctx.repository
          .getMemory()
          .relationships.find((r) => r.id === input.relationshipId)) ||
      ctx.repository.findRelationship({
        fromName: input.fromName,
        toName: input.toName,
        type: input.type,
      });
    if (!rel) {
      return failToolResult({
        toolId: "relationship.remove",
        summary: "Relationship not found",
        errors: ["Relationship not found"],
      });
    }
    return okToolResult({
      toolId: "relationship.remove",
      summary: "Removed relationship",
      patch: {
        remove: [{ type: "relationship", id: rel.id }],
      } as never,
      updatedEntities: [{ type: "relationship", id: rel.id }],
    });
  },
};

export const relationshipTools = [
  relationshipCreateTool,
  relationshipUpdateTool,
  relationshipMergeTool,
  relationshipRemoveTool,
];
