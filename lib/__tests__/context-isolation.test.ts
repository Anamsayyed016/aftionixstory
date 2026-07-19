import { describe, expect, it } from "vitest";

import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import { buildWriteScenePrompt } from "@/lib/ai/prompts/write-scene-prompt";
import { assessDraftRelevance } from "@/lib/story-agent/draft-relevance";
import {
  extractMentionedCharacters,
  looksLikeFreshSceneRequest,
  resolveSceneRequest,
} from "@/lib/story-agent/entity-resolver";
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";

describe("Entity resolver + fresh scene routing", () => {
  it("extracts lowercase azar/anaya from build-kiss request", () => {
    const msg = "Build the azar kiss anaya around an internal conflict.";
    const chars = extractMentionedCharacters(msg);
    expect(chars.map((c) => c.name.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
    const resolved = resolveSceneRequest(msg);
    expect(resolved.characterNames.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
    expect(resolved.conflictHints.some((h) => /internal/i.test(h))).toBe(true);
    expect(resolved.actionHints.some((h) => /kiss/i.test(h))).toBe(true);
  });

  it("routes build-kiss request to write_scene even when unrelated draft exists", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Chhat Pe Baarish",
      content:
        "Meera stood on the rooftop in the rain, thinking of her engagement.",
      wordCount: 12,
      sourceConversationId: "conv_a",
    };
    memory.characters = [
      {
        name: "Meera",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
    ];

    const route = routeIntent(
      "Build the azar kiss anaya around an internal conflict.",
      memory
    );
    expect(route.operation).toBe("write_scene");
    expect(route.operation).not.toBe("revise_draft");
    expect(looksLikeFreshSceneRequest(
      "Build the azar kiss anaya around an internal conflict."
    )).toBe(true);
  });

  it("routes explicit rewrite to revise_draft when draft exists", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Scene",
      content: "A".repeat(80),
      wordCount: 20,
    };
    expect(
      routeIntent("Rewrite the previous scene in Hinglish.", memory).operation
    ).toBe("revise_draft");
  });
});

describe("Context isolation in story context builder", () => {
  it("excludes unrelated Meera cast and previous draft from fresh write_scene", () => {
    const memory = emptyStoryMemory();
    memory.storyMemory = {
      ...memory.storyMemory,
      title: "Chhat Pe Baarish",
      concept: "engaged girl on rainy rooftop",
      setting: "rooftop in the rain",
    };
    memory.characters = [
      {
        name: "Meera",
        role: "engaged",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
    ];
    memory.latestDraft = {
      title: "Chhat Pe Baarish",
      content: "Meera watched the city lights through the rain.",
      wordCount: 8,
      sourceConversationId: "conv_b",
    };

    const ctx = buildStoryContext({
      operation: "write_scene",
      memory,
      userMessage: "Write an Azar–Anaya kiss scene around an internal conflict.",
      conversationId: "conv_b",
    });

    expect(ctx.namedInRequest.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
    expect(ctx.characters.map((c) => c.name.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
    expect(ctx.characters.some((c) => /meera/i.test(c.name))).toBe(false);
    expect(ctx.includeLatestDraft).toBe(false);
    expect(ctx.latestDraftPreview).toBeUndefined();
    expect(ctx.title).toBeUndefined();
    expect(ctx.setting).toBeUndefined();

    const { prompt, system } = buildWriteScenePrompt(ctx);
    expect(prompt).toMatch(/CURRENT REQUEST/);
    expect(prompt).toMatch(/Azar/i);
    expect(prompt).toMatch(/Anaya/i);
    expect(prompt.toLowerCase()).not.toContain("meera");
    expect(prompt.toLowerCase()).not.toContain("chhat pe baarish");
    expect(system.toLowerCase()).toContain("highest priority");
  });

  it("throws CONTEXT_ISOLATION_ERROR when draft source conversation mismatches", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Leak",
      content: "x".repeat(40),
      sourceConversationId: "other_conv",
    };
    expect(() =>
      buildStoryContext({
        operation: "revise_draft",
        memory,
        userMessage: "Rewrite the previous scene.",
        conversationId: "active_conv",
      })
    ).toThrow(/CONTEXT_ISOLATION_ERROR/);
  });

  it("lets current request setting override memory setting for the scene", () => {
    const memory = emptyStoryMemory();
    memory.characters = [
      {
        name: "Azar",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
      {
        name: "Anaya",
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      },
    ];
    memory.storyMemory.setting = "rooftop";
    const ctx = buildStoryContext({
      operation: "write_scene",
      memory,
      userMessage: "Write the scene in Azar’s office.",
      conversationId: "conv_b",
    });
    expect(ctx.settingOverride?.toLowerCase()).toMatch(/office/);
    expect(ctx.setting?.toLowerCase()).toMatch(/office/);
  });
});

describe("Draft relevance validator", () => {
  it("rejects Meera-centered output for Azar/Anaya request", () => {
    const resolved = resolveSceneRequest(
      "Build an Azar–Anaya kiss scene around an internal conflict."
    );
    const result = assessDraftRelevance({
      userMessage: "Build an Azar–Anaya kiss scene around an internal conflict.",
      title: "Chhat Pe Baarish",
      content:
        "Meera stood on the rooftop as rain fell over the city. Her engagement ring felt heavy.",
      resolved,
      previousDraftTitle: "Chhat Pe Baarish",
    });
    expect(result.ok).toBe(false);
    expect(result.missingCharacters.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
  });

  it("accepts output featuring requested characters and conflict", () => {
    const resolved = resolveSceneRequest(
      "Build an Azar–Anaya kiss scene around an internal conflict."
    );
    const result = assessDraftRelevance({
      userMessage: "Build an Azar–Anaya kiss scene around an internal conflict.",
      title: "Almost",
      content:
        "Azar’s hand trembled as he leaned toward Anaya. He wanted the kiss but guilt and fear held him back. Anaya felt the same torn attraction.",
      resolved,
    });
    expect(result.ok).toBe(true);
  });
});
