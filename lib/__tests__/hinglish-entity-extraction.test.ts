import { describe, expect, it } from "vitest";

import {
  extractCanonicalNamesFromSynopsis,
  buildCanonicalStoryContext,
} from "@/lib/story-agent/canonical-story-context";
import { seedMemoryFromMessage } from "@/lib/ai/context/story-context-builder";
import {
  isValidCanonicalEntityName,
  isHinglishFunctionWord,
} from "@/lib/story-agent/entity-guards";
import {
  applyMemoryPatch,
  emptyStoryMemory,
} from "@/lib/story-agent/memory-patch";
import { resolveSceneRequest } from "@/lib/story-agent/entity-resolver";
import { extractGeneratedNameCandidates } from "@/lib/story-agent/draft-relevance";

const hinglishSynopsis = `Azar aur Sameer childhood se business partners hain. Sameer ki beti Anaya Azar ke ghar aati rehti hai. Alya aur Dr. Armaan nikah karna chahte hain, lekin Azar mana karta hai. Jab Anaya samjhati hai to Azar gusse mein usko thappad maarta hai. Anaya nikah arrange karti hai aur Paris chali jati hai. Years later Alya pregnant hoti hai aur Anaya ko call karti hai. Jo chahe usne liya, dil ka mamla tha — lekin yeh verbs hain, characters nahi.`;

describe("Hinglish character extraction", () => {
  it("rejects Hindi function words and English fillers as names", () => {
    for (const word of ["Liya", "Chahe", "Ka", "Just", "Ne", "Se", "Hai", "Then"]) {
      expect(isValidCanonicalEntityName(word)).toBe(false);
    }
    expect(isHinglishFunctionWord("liya")).toBe(true);
    expect(isHinglishFunctionWord("chahe")).toBe(true);
  });

  it("does not promote usne Liya / jo Chahe / Dil Ka into the cast", () => {
    const names = extractCanonicalNamesFromSynopsis(hinglishSynopsis);
    expect(names.map((n) => n.toLowerCase())).not.toEqual(
      expect.arrayContaining(["liya", "chahe", "ka", "just", "ne", "se"])
    );
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/azar/i),
        expect.stringMatching(/sameer/i),
        expect.stringMatching(/anaya/i),
        expect.stringMatching(/alya/i),
        expect.stringMatching(/armaan/i),
      ])
    );
  });

  it("merges new prose names with previously saved azar/anaya memory", () => {
    let memory = applyMemoryPatch(emptyStoryMemory(), {
      characters: [
        {
          name: "azar",
          personality: [],
          goals: [],
          conflicts: [],
          notes: [],
          avoid: [],
        },
        {
          name: "anaya",
          personality: [],
          goals: [],
          conflicts: [],
          notes: [],
          avoid: [],
        },
      ],
    });

    memory = seedMemoryFromMessage(memory, hinglishSynopsis);
    const names = memory.characters.map((c) => c.name.toLowerCase());

    expect(names).toEqual(
      expect.arrayContaining(["azar", "anaya", "sameer", "alya"])
    );
    expect(names).toEqual(
      expect.arrayContaining([expect.stringMatching(/armaan/)])
    );
    expect(names).not.toEqual(
      expect.arrayContaining(["liya", "chahe", "ka", "just"])
    );

    // Prefer improved casing when prose capitalizes the name
    expect(
      memory.characters.find((c) => c.name.toLowerCase() === "azar")?.name
    ).toMatch(/^A/);
  });

  it("puts real cast into soft context for scene routing", () => {
    const memory = seedMemoryFromMessage(
      applyMemoryPatch(emptyStoryMemory(), {
        characters: [
          {
            name: "azar",
            personality: [],
            goals: [],
            conflicts: [],
            notes: [],
            avoid: [],
          },
          {
            name: "anaya",
            personality: [],
            goals: [],
            conflicts: [],
            notes: [],
            avoid: [],
          },
        ],
      }),
      hinglishSynopsis
    );
    const resolved = resolveSceneRequest("Start the story now", memory);
    expect(resolved.softContextCharacters.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
    expect(resolved.softContextCharacters.map((n) => n.toLowerCase())).not.toEqual(
      expect.arrayContaining(["liya", "chahe", "just"])
    );
  });

  it("canonical context excludes hinglish particles even if capitalized mid-prose", () => {
    const poisoned = `Azar ne Anaya ko dekha aur Sameer chup raha. Alya aur Dr. Armaan wait kar rahe the. Usne Liya decide kiya. Jo Chahe woh bole. Dil Ka mamla tha. Just then romance ka conflict clear tha.`;
    const ctx = buildCanonicalStoryContext({
      conversationId: "c_hinglish",
      memory: emptyStoryMemory(),
      recentMessages: [{ role: "user", content: poisoned }],
      latestInstruction: poisoned,
    });
    const names = ctx.characters.map((c) => c.name.toLowerCase());
    expect(names).not.toEqual(
      expect.arrayContaining(["liya", "chahe", "ka", "just"])
    );
    expect(names).toEqual(
      expect.arrayContaining(["azar", "anaya", "sameer", "alya"])
    );
  });

  it("draft name heuristic ignores hinglish function words", () => {
    const generated = extractGeneratedNameCandidates(
      "Harbor",
      "Liya met Chahe. Just then Ka bola. Azar ne Anaya se kaha."
    );
    expect(generated.map((n) => n.toLowerCase())).not.toEqual(
      expect.arrayContaining(["liya", "chahe", "just", "ka"])
    );
    expect(generated.map((n) => n.toLowerCase())).toEqual(
      expect.arrayContaining(["azar", "anaya"])
    );
  });
});
