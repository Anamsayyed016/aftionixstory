import { describe, expect, it } from "vitest";

import { buildReviseDraftPrompt } from "@/lib/ai/prompts/revise-draft-prompt";
import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import {
  checkLanguageCompliance,
  detectLanguageInstruction,
  mergeLanguagePreferences,
  readLanguagePreferences,
} from "@/lib/story-agent/language-preferences";
import { routeIntent } from "@/lib/story-agent/intent-router";
import { emptyStoryMemory } from "@/lib/story-agent/memory-patch";

describe("Language preference detection", () => {
  it("detects hinglish me chahiye as hinglish both", () => {
    const result = detectLanguageInstruction("hinglish me chahiye");
    expect(result.matched).toBe(true);
    expect(result.resolved.narrationLanguage).toBe("hinglish");
    expect(result.resolved.dialogueLanguage).toBe("hinglish");
    expect(result.resolved.scriptPreference).toBe("latin");
  });

  it("preserves narration when only dialogues are updated", () => {
    const existing = readLanguagePreferences({
      narrationLanguage: "english",
      dialogueLanguage: "english",
    });
    const result = detectLanguageInstruction(
      "dialogues hinglish me chahiye",
      existing
    );
    expect(result.resolved.narrationLanguage).toBe("english");
    expect(result.resolved.dialogueLanguage).toBe("hinglish");
  });

  it("parses English narration + Hinglish dialogues", () => {
    const result = detectLanguageInstruction(
      "English narration, Hinglish dialogues"
    );
    expect(result.resolved.narrationLanguage).toBe("english");
    expect(result.resolved.dialogueLanguage).toBe("hinglish");
  });

  it("does not wipe prefs with empty merge", () => {
    const merged = mergeLanguagePreferences(
      {
        narrationLanguage: "hinglish",
        dialogueLanguage: "hinglish",
        scriptPreference: "latin",
        mirrorUserLanguage: false,
      },
      {}
    );
    expect(merged.narrationLanguage).toBe("hinglish");
  });
});

describe("Language revision routing", () => {
  it("routes hinglish me chahiye to revise_draft when draft exists", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Scene",
      content: "Azar looked at Anaya across the quiet courtyard under the rain.",
      wordCount: 12,
    };
    const route = routeIntent("hinglish me chahiye", memory);
    expect(route.operation).toBe("revise_draft");
    expect(route.skipClassifier).toBe(true);
    expect(route.reason).toBe("language_revise_draft");
  });

  it("updates memory only when no draft exists", () => {
    const route = routeIntent("dialogues Hinglish me rakhna", emptyStoryMemory());
    expect(route.operation).toBe("memory_update");
    expect(route.fixedReply).toBeTruthy();
    expect(route.skipClassifier).toBe(true);
  });

  it("routes pure English rewrite with draft to revise_draft", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Scene",
      content: "Tum theek ho? Azar ne soft awaaz mein poocha.",
      wordCount: 10,
    };
    const route = routeIntent("pure English me rewrite karo", memory);
    expect(route.operation).toBe("revise_draft");
    const lang = detectLanguageInstruction("pure English me rewrite karo");
    expect(lang.resolved.narrationLanguage).toBe("english");
  });
});

describe("Revise prompt language block", () => {
  it("includes mandatory Hinglish requirements and full draft", () => {
    const memory = emptyStoryMemory();
    memory.latestDraft = {
      title: "Courtyard",
      content: "A long English scene about Azar and Anaya meeting after class.",
      wordCount: 12,
    };
    memory.userPreferences.narrationLanguage = "hinglish";
    memory.userPreferences.dialogueLanguage = "hinglish";
    const ctx = buildStoryContext({
      operation: "revise_draft",
      memory,
      userMessage: "hinglish me chahiye",
    });
    const { prompt, system } = buildReviseDraftPrompt(ctx, ctx.languagePrefs);
    expect(system.toLowerCase()).toContain("prose only");
    expect(prompt.toLowerCase()).toContain("hinglish");
    expect(prompt).toContain("LANGUAGE REQUIREMENTS");
    expect(prompt).toContain(memory.latestDraft!.content!);
    expect(prompt).not.toContain("memoryPatch");
  });
});

describe("Language compliance check", () => {
  it("flags pure English when hinglish required", () => {
    const check = checkLanguageCompliance(
      "The director walked into the quiet office and spoke carefully about the budget meeting scheduled for tomorrow morning.",
      {
        narrationLanguage: "hinglish",
        dialogueLanguage: "hinglish",
        scriptPreference: "latin",
        mirrorUserLanguage: false,
      }
    );
    expect(check.ok).toBe(false);
  });

  it("accepts hinglish mix", () => {
    const check = checkLanguageCompliance(
      "Azar ne soft awaaz mein kaha, “Tum theek ho?” Anaya ne head shake kiya. Woh nahi samajh paayi ki yeh moment itna heavy kyun lag raha hai, lekin uska dil toh pehle se hi bechain tha.",
      {
        narrationLanguage: "hinglish",
        dialogueLanguage: "hinglish",
        scriptPreference: "latin",
        mirrorUserLanguage: false,
      }
    );
    expect(check.ok).toBe(true);
  });
});
