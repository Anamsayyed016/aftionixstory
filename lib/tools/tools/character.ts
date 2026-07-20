/**
 * Character tools (Phase G).
 */

import { z } from "zod";
import { normalizeName } from "@/lib/story-memory/v2/normalize";
import type { StoryToolDefinition } from "@/lib/tools/types";
import { failToolResult, okToolResult } from "@/lib/tools/tool-result";

const renameInput = z.object({
  characterId: z.string().min(1).optional(),
  oldName: z.string().trim().min(1).max(100).optional(),
  newName: z.string().trim().min(1).max(100),
});

const createInput = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(100).optional(),
  personalityTraits: z.array(z.string()).optional(),
  age: z.union([z.number(), z.string()]).optional(),
  occupation: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

const updateInput = z.object({
  characterId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.string().optional(),
  personalityTraits: z.array(z.string()).optional(),
  age: z.union([z.number(), z.string()]).optional(),
  occupation: z.string().optional(),
  notes: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  replaceTraits: z.boolean().optional(),
});

const mergeInput = z.object({
  keepId: z.string().min(1).optional(),
  keepName: z.string().trim().min(1).optional(),
  mergeId: z.string().min(1).optional(),
  mergeName: z.string().trim().min(1).optional(),
});

const idOrNameInput = z.object({
  characterId: z.string().min(1).optional(),
  name: z.string().trim().min(1).optional(),
});

function resolveCharacter(
  repo: { findCharacterByName: (n: string) => { id: string; name: string; aliases: string[] } | null; getMemory: () => { characters: Array<{ id: string; name: string; aliases: string[] }> } },
  characterId?: string,
  name?: string
) {
  if (characterId) {
    return repo.getMemory().characters.find((c) => c.id === characterId) ?? null;
  }
  if (name) return repo.findCharacterByName(name);
  return null;
}

export const characterRenameTool: StoryToolDefinition<z.infer<typeof renameInput>> = {
  id: "character.rename",
  version: "1.0.0",
  description: "Rename a character and keep the old name as an alias",
  inputSchema: renameInput,
  validator: renameInput,
  metadata: { category: "character", mutates: true, idempotent: true },
  executor(input, ctx) {
    const existing = resolveCharacter(
      ctx.repository,
      input.characterId,
      input.oldName
    );
    if (!existing) {
      return failToolResult({
        toolId: "character.rename",
        summary: "Character not found",
        errors: [`No character matching ${input.characterId || input.oldName}`],
      });
    }
    const conflict = ctx.repository.findCharacterByName(input.newName);
    if (conflict && conflict.id !== existing.id) {
      return failToolResult({
        toolId: "character.rename",
        summary: "Name already in use",
        errors: [`Another character already uses the name ${input.newName}`],
      });
    }
    const oldName = existing.name;
    const aliases = Array.from(
      new Set(
        [...existing.aliases, oldName].filter(
          (a) => normalizeName(a) !== normalizeName(input.newName)
        )
      )
    );
    return okToolResult({
      toolId: "character.rename",
      summary: `Renamed ${oldName} to ${input.newName}`,
      patch: {
        upsertCharacters: [
          {
            id: existing.id,
            name: input.newName,
            aliases,
          },
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "character", id: existing.id, name: input.newName },
      ],
    });
  },
};

export const characterCreateTool: StoryToolDefinition<z.infer<typeof createInput>> = {
  id: "character.create",
  version: "1.0.0",
  description: "Create a new character",
  inputSchema: createInput,
  validator: createInput,
  metadata: { category: "character", mutates: true },
  executor(input, ctx) {
    const existing = ctx.repository.findCharacterByName(input.name);
    if (existing) {
      return failToolResult({
        toolId: "character.create",
        summary: "Duplicate character",
        errors: [`Character ${input.name} already exists`],
        warnings: ["Use character.update or character.rename instead"],
      });
    }
    return okToolResult({
      toolId: "character.create",
      summary: `Created character ${input.name}`,
      patch: {
        upsertCharacters: [
          {
            name: input.name,
            role: input.role ?? null,
            personalityTraits: input.personalityTraits ?? [],
            age: input.age ?? null,
            occupation: input.occupation ?? null,
            notes: input.notes ?? [],
          },
        ],
      } as never,
      updatedEntities: [{ type: "character", name: input.name }],
    });
  },
};

export const characterUpdateTool: StoryToolDefinition<z.infer<typeof updateInput>> = {
  id: "character.update",
  version: "1.0.0",
  description: "Update fields on an existing character",
  inputSchema: updateInput,
  validator: updateInput,
  metadata: { category: "character", mutates: true, idempotent: true },
  executor(input, ctx) {
    const existing = resolveCharacter(
      ctx.repository,
      input.characterId,
      input.name
    );
    if (!existing) {
      return failToolResult({
        toolId: "character.update",
        summary: "Character not found",
        errors: ["Character not found for update"],
      });
    }
    return okToolResult({
      toolId: "character.update",
      summary: `Updated ${existing.name}`,
      patch: {
        upsertCharacters: [
          {
            id: existing.id,
            name: existing.name,
            role: input.role,
            personalityTraits: input.personalityTraits,
            age: input.age,
            occupation: input.occupation,
            notes: input.notes,
            status: input.status,
            replaceTraits: input.replaceTraits,
            allowConflicts: true,
          } as never,
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "character", id: existing.id, name: existing.name },
      ],
    });
  },
};

export const characterMergeTool: StoryToolDefinition<z.infer<typeof mergeInput>> = {
  id: "character.merge",
  version: "1.0.0",
  description: "Merge one character into another (archive the duplicate)",
  inputSchema: mergeInput,
  validator: mergeInput,
  metadata: { category: "character", mutates: true },
  executor(input, ctx) {
    const keep = resolveCharacter(ctx.repository, input.keepId, input.keepName);
    const merge = resolveCharacter(
      ctx.repository,
      input.mergeId,
      input.mergeName
    );
    if (!keep || !merge) {
      return failToolResult({
        toolId: "character.merge",
        summary: "Merge targets missing",
        errors: ["Both keep and merge characters are required"],
      });
    }
    if (keep.id === merge.id) {
      return failToolResult({
        toolId: "character.merge",
        summary: "Cannot merge a character into itself",
        errors: ["keep and merge refer to the same character"],
      });
    }
    const aliases = Array.from(
      new Set([...keep.aliases, merge.name, ...merge.aliases])
    );
    return okToolResult({
      toolId: "character.merge",
      summary: `Merged ${merge.name} into ${keep.name}`,
      patch: {
        upsertCharacters: [
          {
            id: keep.id,
            name: keep.name,
            aliases,
            allowConflicts: true,
          } as never,
          {
            id: merge.id,
            name: merge.name,
            status: "archived",
            allowConflicts: true,
          } as never,
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "character", id: keep.id, name: keep.name },
        { type: "character", id: merge.id, name: merge.name },
      ],
    });
  },
};

export const characterArchiveTool: StoryToolDefinition<z.infer<typeof idOrNameInput>> = {
  id: "character.archive",
  version: "1.0.0",
  description: "Archive a character",
  inputSchema: idOrNameInput,
  validator: idOrNameInput,
  metadata: { category: "character", mutates: true, idempotent: true },
  executor(input, ctx) {
    const existing = resolveCharacter(
      ctx.repository,
      input.characterId,
      input.name
    );
    if (!existing) {
      return failToolResult({
        toolId: "character.archive",
        summary: "Character not found",
        errors: ["Character not found"],
      });
    }
    return okToolResult({
      toolId: "character.archive",
      summary: `Archived ${existing.name}`,
      patch: {
        upsertCharacters: [
          {
            id: existing.id,
            name: existing.name,
            status: "archived",
            allowConflicts: true,
          } as never,
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "character", id: existing.id, name: existing.name },
      ],
    });
  },
};

export const characterRestoreTool: StoryToolDefinition<z.infer<typeof idOrNameInput>> = {
  id: "character.restore",
  version: "1.0.0",
  description: "Restore an archived character",
  inputSchema: idOrNameInput,
  validator: idOrNameInput,
  metadata: { category: "character", mutates: true, idempotent: true },
  executor(input, ctx) {
    const existing = resolveCharacter(
      ctx.repository,
      input.characterId,
      input.name
    );
    if (!existing) {
      return failToolResult({
        toolId: "character.restore",
        summary: "Character not found",
        errors: ["Character not found"],
      });
    }
    return okToolResult({
      toolId: "character.restore",
      summary: `Restored ${existing.name}`,
      patch: {
        upsertCharacters: [
          {
            id: existing.id,
            name: existing.name,
            status: "active",
            allowConflicts: true,
          } as never,
        ],
        allowConflicts: true,
      } as never,
      updatedEntities: [
        { type: "character", id: existing.id, name: existing.name },
      ],
    });
  },
};

export const characterTools = [
  characterCreateTool,
  characterRenameTool,
  characterUpdateTool,
  characterMergeTool,
  characterArchiveTool,
  characterRestoreTool,
];
