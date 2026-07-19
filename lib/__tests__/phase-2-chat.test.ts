import { describe, expect, it, vi } from "vitest";

import { MockAIProvider } from "@/lib/ai/providers/mock";
import { runChatCreateStoryTurn } from "@/lib/ai/services/chat-create-story";
import {
  evaluateStoryCompleteness,
  extractJsonObject,
  normalizeChatStoryDraft,
  parseChatCreateExtraction,
  sanitizeExtractionPlaceholders,
} from "@/lib/chat/create-story-extraction";

const completePayload = {
  status: "complete",
  missing: [],
  assistantReply: "Great — we have enough to create your story.",
  story: {
    title: "Midnight Contract",
    description: "A forbidden office romance with high stakes.",
    genre: "Dark Romance",
    language: "English",
    tone: "tense",
    setting: "Mumbai corporate tower",
    targetAudience: "Adult romance readers",
    pov: "Third person limited",
    writingStyle: "Cinematic",
    pacing: "Slow burn",
    themes: ["power", "secrecy"],
    plot: "An assistant and a CEO hide their relationship while a rival watches.",
    characters: [
      {
        clientId: "c1",
        name: "Aanya",
        role: "Protagonist",
        personality: "Sharp, guarded, quietly romantic",
      },
      {
        clientId: "c2",
        name: "Rohan",
        role: "Love interest",
        personality: "Controlling at work, soft in private",
      },
    ],
    relationships: [
      {
        sourceClientId: "c1",
        targetClientId: "c2",
        relationshipType: "secretly in love",
      },
    ],
    writingRules: [
      {
        rule: "Keep emotional tension high in every scene",
        category: "tone",
        priority: 8,
        isActive: true,
      },
    ],
  },
};

const incompletePayload = {
  status: "needs_more_info",
  missing: ["characters", "language"],
  assistantReply: "I love that dark fantasy spark. Who are the main characters?",
  story: {
    title: "Cursed Crown",
    genre: "Fantasy",
    tone: "dark",
    setting: "A kingdom under a blood moon",
  },
};

const placeholderPayload = {
  status: "needs_more_info",
  missing: ["title", "language", ""],
  assistantReply: "Tell me more about the world and who leads it.",
  story: {
    title: "",
    genre: "Fantasy",
    themes: ["", "curse", "  "],
    genres: ["Fantasy", "", "  "],
    characters: [
      {
        clientId: "c1",
        name: "",
        role: "",
        personality: "",
      },
      {
        clientId: "c2",
        name: "Kael",
        role: "Protagonist",
        personality: "Stoic and cursed",
      },
    ],
    relationships: [
      {
        sourceClientId: "c1",
        targetClientId: "c2",
        relationshipType: "",
        description: "",
      },
      {
        sourceClientId: "",
        targetClientId: "",
        relationshipType: "rivals",
        description: "empty refs",
      },
      {
        sourceClientId: "c2",
        targetClientId: "c3",
        relationshipType: "mentor",
        description: "valid",
      },
    ],
    writingRules: [
      { rule: "", category: "style", priority: 5, isActive: true },
      {
        rule: "Keep magic costly",
        category: "world",
        priority: 7,
        isActive: true,
      },
    ],
  },
};

describe("Phase 2 chat — JSON extraction", () => {
  it("parses fenced JSON", () => {
    const raw = `\`\`\`json\n${JSON.stringify(completePayload)}\n\`\`\``;
    expect(extractJsonObject(raw)).toEqual(completePayload);
  });

  it("parses a complete extraction", () => {
    const parsed = parseChatCreateExtraction(JSON.stringify(completePayload));
    expect(parsed.status).toBe("complete");
    expect(parsed.assistantReply).toContain("create");
  });

  it("rejects invalid JSON", () => {
    expect(() => extractJsonObject("not json")).toThrow();
  });
});

describe("Phase 2 chat — placeholder normalization", () => {
  it("removes placeholder characters with empty names", () => {
    const cleaned = sanitizeExtractionPlaceholders(placeholderPayload) as {
      story: { characters: Array<{ name: string }> };
    };
    expect(cleaned.story.characters).toHaveLength(1);
    expect(cleaned.story.characters[0].name).toBe("Kael");
  });

  it("removes placeholder relationships", () => {
    const cleaned = sanitizeExtractionPlaceholders(placeholderPayload) as {
      story: { relationships: Array<{ relationshipType: string }> };
    };
    expect(cleaned.story.relationships).toHaveLength(1);
    expect(cleaned.story.relationships[0].relationshipType).toBe("mentor");
  });

  it("removes placeholder writing rules", () => {
    const cleaned = sanitizeExtractionPlaceholders(placeholderPayload) as {
      story: { writingRules: Array<{ rule: string }> };
    };
    expect(cleaned.story.writingRules).toHaveLength(1);
    expect(cleaned.story.writingRules[0].rule).toBe("Keep magic costly");
  });

  it("removes placeholder themes and genres", () => {
    const cleaned = sanitizeExtractionPlaceholders(placeholderPayload) as {
      story: { themes: string[]; genres: string[] };
    };
    expect(cleaned.story.themes).toEqual(["curse"]);
    expect(cleaned.story.genres).toEqual(["Fantasy"]);
  });

  it("still parses valid extractions after normalization", () => {
    const parsed = parseChatCreateExtraction(JSON.stringify(completePayload));
    expect(parsed.status).toBe("complete");
    expect(parsed.story?.characters).toHaveLength(2);
  });

  it("parses placeholder-heavy JSON without INVALID_EXTRACTION", () => {
    const parsed = parseChatCreateExtraction(JSON.stringify(placeholderPayload));
    expect(parsed.status).toBe("needs_more_info");
    expect(parsed.story?.characters).toHaveLength(1);
    expect(parsed.story?.relationships).toHaveLength(1);
    expect(parsed.story?.writingRules).toHaveLength(1);
  });
});

describe("Phase 2 chat — missing fields and completeness", () => {
  it("marks incomplete drafts as needs_more_info", () => {
    const draft = normalizeChatStoryDraft(incompletePayload.story);
    const result = evaluateStoryCompleteness(draft);
    expect(result.status).toBe("needs_more_info");
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.wizardInput).toBeNull();
  });

  it("marks a full draft complete and returns wizard input", () => {
    const draft = normalizeChatStoryDraft(completePayload.story);
    const result = evaluateStoryCompleteness(draft);
    expect(result.status).toBe("complete");
    expect(result.missing).toEqual([]);
    expect(result.wizardInput?.title).toBe("Midnight Contract");
    expect(result.wizardInput?.characters).toHaveLength(2);
  });

  it("allows edits before create by re-evaluating completeness", () => {
    const draft = normalizeChatStoryDraft(completePayload.story);
    const incompleteEdit = {
      ...draft,
      title: "AB",
    };
    const result = evaluateStoryCompleteness(incompleteEdit);
    expect(result.status).toBe("needs_more_info");
    expect(result.missing).toContain("title");
  });

  it("keeps Create disabled until complete", () => {
    const incomplete = evaluateStoryCompleteness(
      normalizeChatStoryDraft(incompletePayload.story)
    );
    const complete = evaluateStoryCompleteness(
      normalizeChatStoryDraft(completePayload.story)
    );
    expect(incomplete.status === "complete" && incomplete.wizardInput).toBeFalsy();
    expect(complete.status === "complete" && complete.wizardInput).toBeTruthy();
  });
});

describe("Phase 2 chat — conversation turn with mock provider", () => {
  it("returns assistant reply and incomplete story on first sparse message", async () => {
    const provider = new MockAIProvider(() => JSON.stringify(incompletePayload));
    const result = await runChatCreateStoryTurn({
      messages: [{ role: "user", content: "A dark fantasy about a cursed kingdom" }],
      provider,
    });
    expect(result.assistantReply).toContain("characters");
    expect(result.status).toBe("needs_more_info");
    expect(result.story.title).toBe("Cursed Crown");
  });

  it("returns complete extraction when model provides full details", async () => {
    const provider = new MockAIProvider(() => JSON.stringify(completePayload));
    const result = await runChatCreateStoryTurn({
      messages: [
        {
          role: "user",
          content:
            "Forbidden CEO romance in Mumbai, English, slow burn, leads Aanya and Rohan",
        },
      ],
      provider,
    });
    expect(result.status).toBe("complete");
    expect(result.wizardInput?.genre).toBe("Dark Romance");
  });

  it("does not trigger repair after placeholder normalization", async () => {
    let calls = 0;
    const provider = new MockAIProvider((input) => {
      calls += 1;
      expect(input.reasoningEffort).toBe("minimal");
      return JSON.stringify(placeholderPayload);
    });
    const result = await runChatCreateStoryTurn({
      messages: [{ role: "user", content: "hi" }],
      provider,
    });
    expect(calls).toBe(1);
    expect(result.status).toBe("needs_more_info");
    expect(result.story.characters).toHaveLength(1);
    expect(result.story.characters[0].name).toBe("Kael");
  });

  it("retries once when first response is invalid JSON", async () => {
    let calls = 0;
    const provider = new MockAIProvider(() => {
      calls += 1;
      if (calls === 1) return "totally not json";
      return JSON.stringify(completePayload);
    });
    const result = await runChatCreateStoryTurn({
      messages: [{ role: "user", content: "Help me create a romance" }],
      provider,
    });
    expect(calls).toBe(2);
    expect(result.status).toBe("complete");
  });

  it("triggers repair only when genuinely required", async () => {
    let calls = 0;
    const provider = new MockAIProvider(() => {
      calls += 1;
      if (calls === 1) {
        return JSON.stringify({
          status: "needs_more_info",
          // missing assistantReply — genuinely invalid after sanitize
          story: { title: "X" },
        });
      }
      return JSON.stringify(incompletePayload);
    });
    const result = await runChatCreateStoryTurn({
      messages: [{ role: "user", content: "Hello" }],
      provider,
    });
    expect(calls).toBe(2);
    expect(result.assistantReply).toContain("characters");
  });

  it("fails with friendly invalid response after retry", async () => {
    const provider = new MockAIProvider(() => "still broken");
    await expect(
      runChatCreateStoryTurn({
        messages: [{ role: "user", content: "Hello" }],
        provider,
      })
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
});

describe("Phase 2 chat — create action called once guard", () => {
  it("documents single-create lock behavior via completeness gate", () => {
    const createOnce = vi.fn();
    const evaluated = evaluateStoryCompleteness(
      normalizeChatStoryDraft(completePayload.story)
    );
    let locked = false;
    function handleCreate() {
      if (locked) return;
      if (evaluated.status !== "complete" || !evaluated.wizardInput) return;
      locked = true;
      createOnce(evaluated.wizardInput);
    }
    handleCreate();
    handleCreate();
    expect(createOnce).toHaveBeenCalledTimes(1);
  });
});
