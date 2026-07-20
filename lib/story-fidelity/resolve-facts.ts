/**
 * Deterministic fact resolver (Phase G.5).
 * Priority: latest explicit instruction → corrections → locked → writing rules → prefs → defaults
 */

import type { StoryMemory } from "@/lib/story-agent/schema";
import { getMemoryV2 } from "@/lib/story-agent/memory-patch";
import {
  resolvedStoryFactsSchema,
  type InstructionFidelityState,
  type ResolvedStoryFacts,
  instructionFidelityStateSchema,
} from "@/lib/story-fidelity/schemas";
import { lockField, setLockedAwareField } from "@/lib/story-fidelity/locked-facts";
import { recordAnsweredQuestionsFromFacts } from "@/lib/story-fidelity/answered-questions";

function emptyFacts(): ResolvedStoryFacts {
  return resolvedStoryFactsSchema.parse({});
}

export function readFidelityState(
  memory: StoryMemory
): InstructionFidelityState {
  const v2 = getMemoryV2(memory);
  const fromMeta = (v2.metadata as Record<string, unknown>)?.instructionFidelity;
  const fromCustom = (v2.userPreferences.custom as Record<string, unknown>)
    ?.instructionFidelity;
  const parsed = instructionFidelityStateSchema.safeParse(
    fromMeta ?? fromCustom
  );
  if (parsed.success) return parsed.data;
  return instructionFidelityStateSchema.parse({
    resolvedFacts: emptyFacts(),
    answeredQuestions: [],
  });
}

export function writeFidelityState(
  memory: StoryMemory,
  state: InstructionFidelityState
): StoryMemory {
  const v2 = getMemoryV2(memory);
  const fidelity = instructionFidelityStateSchema.parse(state);
  const nextV2 = {
    ...v2,
    metadata: {
      ...v2.metadata,
      instructionFidelity: fidelity,
    },
    userPreferences: {
      ...v2.userPreferences,
      doNotStartYet: fidelity.resolvedFacts.conversationRules.doNotStartStoryYet,
      storyLanguage:
        fidelity.resolvedFacts.language.storyLanguage ||
        v2.userPreferences.storyLanguage,
      responseLanguage:
        fidelity.resolvedFacts.language.responseLanguage ||
        v2.userPreferences.responseLanguage,
      dialogueLanguage:
        fidelity.resolvedFacts.language.dialogueLanguage ||
        v2.userPreferences.dialogueLanguage,
      custom: {
        ...(v2.userPreferences.custom || {}),
        instructionFidelity: fidelity,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  // Sync locked leads into characters list (id-stable upsert by name)
  const facts = fidelity.resolvedFacts;
  const leads = [
    facts.characters.mainMaleLead,
    facts.characters.mainFemaleLead,
    ...facts.characters.confirmedCharacters,
  ].filter(Boolean) as string[];

  const chars = [...nextV2.characters];
  for (const name of leads) {
    const aliases =
      facts.characters.aliases[name] ||
      Object.entries(facts.characters.aliases).find(([, a]) =>
        a.some((x) => x.toLowerCase() === name.toLowerCase())
      )?.[1] ||
      [];
    const role =
      name === facts.characters.mainMaleLead
        ? "male_lead"
        : name === facts.characters.mainFemaleLead
          ? "female_lead"
          : null;
    const idx = chars.findIndex(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() ||
        c.aliases.some((a) => a.toLowerCase() === name.toLowerCase()) ||
        aliases.some((a) => a.toLowerCase() === c.name.toLowerCase())
    );
    if (idx >= 0) {
      chars[idx] = {
        ...chars[idx],
        name,
        role: role || chars[idx].role,
        aliases: Array.from(
          new Set([
            ...chars[idx].aliases,
            ...aliases.filter((a) => a.toLowerCase() !== name.toLowerCase()),
          ])
        ),
      };
    } else {
      chars.push({
        id: `char_${name.toLowerCase().replace(/\s+/g, "_")}`,
        name,
        aliases: aliases.filter((a) => a.toLowerCase() !== name.toLowerCase()),
        role,
        gender: null,
        age: null,
        occupation: null,
        personalityTraits: [],
        appearance: [],
        goals: [],
        fears: [],
        strengths: [],
        weaknesses: [],
        backstory: null,
        currentState: null,
        status: "active",
        notes: [],
        avoid: [],
      });
    }
  }

  if (facts.setting.primarySetting) {
    nextV2.story = {
      ...nextV2.story,
      setting: facts.setting.primarySetting,
      language: facts.language.storyLanguage || nextV2.story.language,
      genre: facts.genre.length > 0 ? facts.genre : nextV2.story.genre,
      tone: facts.tone.length > 0 ? facts.tone : nextV2.story.tone,
    };
  }

  const wrapped = Object.assign(
    {
      ...memory,
      storyMemory: {
        ...memory.storyMemory,
        setting: nextV2.story.setting ?? memory.storyMemory.setting,
        concept: nextV2.story.concept ?? memory.storyMemory.concept,
        title: nextV2.story.title ?? memory.storyMemory.title,
        genre: nextV2.story.genre.length
          ? nextV2.story.genre
          : memory.storyMemory.genre,
        tone: nextV2.story.tone.length
          ? nextV2.story.tone
          : memory.storyMemory.tone,
      },
      characters: chars.map((c) => ({
        name: c.name,
        role: c.role ?? undefined,
        personality: c.personalityTraits,
        personalityTraits: c.personalityTraits,
        aliases: c.aliases,
        goals: c.goals,
        conflicts: [],
        notes: c.notes,
        avoid: c.avoid,
      })),
      userPreferences: {
        ...memory.userPreferences,
        doNotStartYet: nextV2.userPreferences.doNotStartYet,
        storyLanguage: nextV2.userPreferences.storyLanguage,
        responseLanguage: nextV2.userPreferences.responseLanguage,
        dialogueLanguage: nextV2.userPreferences.dialogueLanguage,
        custom: nextV2.userPreferences.custom,
      },
      memoryVersion: 2,
      __memoryV2: { ...nextV2, characters: chars },
      updatedAt: nextV2.updatedAt,
    } as unknown as StoryMemory
  );

  return wrapped;
}

function titleCaseName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function normalizeLang(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.includes("hinglish") || t.includes("roman hindi")) return "hinglish";
  if (t.includes("urdu")) return "urdu";
  if (t.includes("hindi") && !t.includes("hinglish")) return "hindi";
  if (t.includes("english")) return "english";
  return t;
}

/**
 * Extract explicit facts from a single user message (deterministic).
 */
export function extractExplicitFactsFromMessage(
  userMessage: string
): Partial<{
  storyLanguage: string;
  mainMaleLead: string;
  mainFemaleLead: string;
  rename: { from: string; to: string };
  primarySetting: string;
  doNotStart: boolean;
  startNow: boolean;
  uppercaseNames: boolean;
  emotionBrackets: boolean;
  dialogueNextLine: boolean;
  sceneDivisions: boolean;
  genre: string[];
  tone: string[];
}> {
  const text = userMessage.trim();
  const lower = text.toLowerCase();
  const out: ReturnType<typeof extractExplicitFactsFromMessage> = {};

  if (
    /^(hinglish|write in hinglish|story (?:in )?hinglish)\b/i.test(lower) ||
    (/\bhinglish\b/i.test(lower) && lower.length < 40)
  ) {
    out.storyLanguage = "hinglish";
  } else if (/\b(?:in|use)\s+hinglish\b/i.test(lower)) {
    out.storyLanguage = "hinglish";
  }

  const rename =
    text.match(
      /(?:rename|renaming)\s+["']?([A-Za-z][\w'-]*)["']?\s+(?:to|as)\s+["']?([A-Za-z][\w'-]*)["']?/i
    ) ||
    text.match(
      /(?:change)\s+["']?([A-Za-z][\w'-]*)["']?\s*(?:'s)?\s*name\s+to\s+["']?([A-Za-z][\w'-]*)["']?/i
    );
  if (rename) {
    out.rename = {
      from: titleCaseName(rename[1]),
      to: titleCaseName(rename[2]),
    };
  }

  const leads = text.match(
    /([A-Za-z][\w'-]*)\s+(?:main\s+)?(?:lead\s+)?male(?:\s+lead)?(?:\s+and|,)\s*([A-Za-z][\w'-]*)\s+(?:female(?:\s+main)?(?:\s+lead)?|(?:main\s+)?female(?:\s+lead)?)/i
  ) ||
    text.match(
      /male\s+(?:lead|main)?\s*[:=]?\s*([A-Za-z][\w'-]*).*female\s+(?:lead|main)?\s*[:=]?\s*([A-Za-z][\w'-]*)/i
    ) ||
    text.match(
      /([A-Za-z][\w'-]*)\s+main\s+lead\s+male\s+and\s+([A-Za-z][\w'-]*)\s+female\s+main\s+lead/i
    );
  if (leads) {
    out.mainMaleLead = titleCaseName(leads[1]);
    out.mainFemaleLead = titleCaseName(leads[2]);
  }

  if (
    /^(college|university|campus)\s*[.!]?$/i.test(lower) ||
    /\b(?:setting|set)\s*(?:is|=|:)?\s*college\b/i.test(lower) ||
    (/\bcollege\b/i.test(lower) && lower.length < 30)
  ) {
    out.primarySetting = "college";
  } else if (/\b(?:cafe|café)\b/i.test(lower) && /setting|set /i.test(lower)) {
    out.primarySetting = "cafe";
  }

  if (
    /abhi\s+story\s+start\s+nahi|do\s+not\s+start|don't\s+start|not\s+yet|mat\s+likho|start\s+nahi\s+karna/i.test(
      lower
    )
  ) {
    out.doNotStart = true;
  }

  if (
    /^(start\s+the\s+story|start\s+now|start\s+writing|likhna\s+shuru|shuru\s+karo)\b/i.test(
      lower
    ) ||
    /\bstart\s+the\s+story\b/i.test(lower)
  ) {
    out.startNow = true;
  }

  if (/uppercase|upper\s*case|capital\s*letter|character\s+uppercase/i.test(lower)) {
    out.uppercaseNames = true;
  }
  if (/emotion\s+in\s+brackets|emotions?\s+in\s*\(|\[emotion\]/i.test(lower)) {
    out.emotionBrackets = true;
  }
  if (
    /just\s+niche\s+dialogue|dialogue\s+on\s+(?:the\s+)?next\s+line|uske\s+just\s+niche\s+dialogue/i.test(
      lower
    )
  ) {
    out.dialogueNextLine = true;
  }
  if (
    /episode\s+scene\s+(?:me\s+)?divid|scene\s+(?:me\s+)?divid|divide\s+(?:into\s+)?scenes|scene\s+divisions/i.test(
      lower
    )
  ) {
    out.sceneDivisions = true;
  }

  return out;
}

export function resolveStoryFacts(params: {
  userMessage: string;
  memory: StoryMemory;
  turnRequestId?: string;
  explicitCorrection?: boolean;
}): {
  facts: ResolvedStoryFacts;
  state: InstructionFidelityState;
  extracted: ReturnType<typeof extractExplicitFactsFromMessage>;
} {
  const prev = readFidelityState(params.memory);
  let facts = resolvedStoryFactsSchema.parse(prev.resolvedFacts);
  const extracted = extractExplicitFactsFromMessage(params.userMessage);
  const now = new Date().toISOString();
  const correction = Boolean(params.explicitCorrection || extracted.rename);

  // From memory preferences (lower priority fill)
  const prefs = getMemoryV2(params.memory).userPreferences;
  if (!facts.language.storyLanguage && prefs.storyLanguage) {
    facts = {
      ...facts,
      language: {
        ...facts.language,
        storyLanguage: normalizeLang(String(prefs.storyLanguage)),
      },
    };
  }
  if (prefs.doNotStartYet && !extracted.startNow) {
    facts = {
      ...facts,
      conversationRules: {
        ...facts.conversationRules,
        doNotStartStoryYet: true,
      },
      storyStatus: facts.storyStatus === "writing" ? "planning" : facts.storyStatus,
    };
  }

  // From existing characters if unlocked empty
  const v2 = getMemoryV2(params.memory);
  if (!facts.characters.mainMaleLead) {
    const male = v2.characters.find((c) => c.role === "male_lead");
    if (male) {
      facts = {
        ...facts,
        characters: { ...facts.characters, mainMaleLead: male.name },
      };
    }
  }
  if (!facts.characters.mainFemaleLead) {
    const female = v2.characters.find((c) => c.role === "female_lead");
    if (female) {
      facts = {
        ...facts,
        characters: { ...facts.characters, mainFemaleLead: female.name },
      };
    }
  }
  if (!facts.setting.primarySetting && v2.story.setting) {
    facts = {
      ...facts,
      setting: { ...facts.setting, primarySetting: v2.story.setting },
    };
  }

  // Latest explicit instruction wins
  if (extracted.storyLanguage) {
    facts = setLockedAwareField({
      facts,
      field: "language.storyLanguage",
      value: extracted.storyLanguage,
      get: (f) => f.language.storyLanguage,
      set: (f, v) => ({
        ...f,
        language: { ...f.language, storyLanguage: v, dialogueLanguage: v },
      }),
      explicitCorrection: correction,
      lock: true,
    });
  }

  if (extracted.rename) {
    const { from, to } = extracted.rename;
    const wasMale =
      facts.characters.mainMaleLead?.toLowerCase() === from.toLowerCase();
    const wasFemale =
      facts.characters.mainFemaleLead?.toLowerCase() === from.toLowerCase();
    const aliases = { ...facts.characters.aliases };
    aliases[to] = Array.from(
      new Set([...(aliases[to] || []), from, ...(aliases[from] || [])])
    );
    delete aliases[from];
    facts = {
      ...facts,
      characters: {
        ...facts.characters,
        mainMaleLead: wasMale ? to : facts.characters.mainMaleLead,
        mainFemaleLead: wasFemale ? to : facts.characters.mainFemaleLead,
        confirmedCharacters: facts.characters.confirmedCharacters.map((n) =>
          n.toLowerCase() === from.toLowerCase() ? to : n
        ),
        aliases,
      },
    };
    facts = lockField(facts, "characters.mainMaleLead");
    facts = lockField(facts, "characters.mainFemaleLead");
  }

  if (extracted.mainMaleLead && extracted.mainFemaleLead) {
    facts = setLockedAwareField({
      facts,
      field: "characters.mainMaleLead",
      value: extracted.mainMaleLead,
      get: (f) => f.characters.mainMaleLead,
      set: (f, v) => ({
        ...f,
        characters: {
          ...f.characters,
          mainMaleLead: v,
          confirmedCharacters: Array.from(
            new Set([
              ...f.characters.confirmedCharacters,
              v!,
              extracted.mainFemaleLead!,
            ])
          ),
        },
      }),
      explicitCorrection: correction,
      lock: true,
    });
    facts = setLockedAwareField({
      facts,
      field: "characters.mainFemaleLead",
      value: extracted.mainFemaleLead,
      get: (f) => f.characters.mainFemaleLead,
      set: (f, v) => ({
        ...f,
        characters: { ...f.characters, mainFemaleLead: v },
      }),
      explicitCorrection: correction,
      lock: true,
    });
  }

  if (extracted.primarySetting) {
    facts = setLockedAwareField({
      facts,
      field: "setting.primarySetting",
      value: extracted.primarySetting,
      get: (f) => f.setting.primarySetting,
      set: (f, v) => ({
        ...f,
        setting: { ...f.setting, primarySetting: v },
      }),
      explicitCorrection: correction,
      lock: true,
    });
  }

  if (extracted.uppercaseNames) {
    facts = {
      ...facts,
      formatRules: { ...facts.formatRules, uppercaseCharacterNames: true },
    };
    facts = lockField(facts, "formatRules.uppercaseCharacterNames");
  }
  if (extracted.emotionBrackets) {
    facts = {
      ...facts,
      formatRules: { ...facts.formatRules, emotionInBrackets: true },
    };
    facts = lockField(facts, "formatRules.emotionInBrackets");
  }
  if (extracted.dialogueNextLine) {
    facts = {
      ...facts,
      formatRules: { ...facts.formatRules, dialogueOnNextLine: true },
    };
    facts = lockField(facts, "formatRules.dialogueOnNextLine");
  }
  if (extracted.sceneDivisions) {
    facts = {
      ...facts,
      formatRules: {
        ...facts.formatRules,
        sceneDivisions: true,
        episodeStructure: true,
      },
    };
    facts = lockField(facts, "formatRules.sceneDivisions");
  }

  if (extracted.doNotStart) {
    facts = {
      ...facts,
      storyStatus: "planning",
      conversationRules: {
        ...facts.conversationRules,
        doNotStartStoryYet: true,
      },
    };
    facts = lockField(facts, "conversationRules.doNotStartStoryYet");
  }

  if (extracted.startNow) {
    facts = {
      ...facts,
      storyStatus: "writing",
      conversationRules: {
        ...facts.conversationRules,
        doNotStartStoryYet: false,
      },
    };
  }

  // Promote to ready when core facts exist and not blocked
  if (
    !facts.conversationRules.doNotStartStoryYet &&
    facts.characters.mainMaleLead &&
    facts.characters.mainFemaleLead &&
    facts.storyStatus === "planning"
  ) {
    facts = { ...facts, storyStatus: "ready" };
  }

  facts = {
    ...facts,
    metadata: {
      ...facts.metadata,
      sourceTurnId: params.turnRequestId ?? facts.metadata.sourceTurnId,
      updatedAt: now,
      confidence: 0.9,
    },
  };

  const answered = recordAnsweredQuestionsFromFacts(
    prev.answeredQuestions,
    facts
  );

  const state: InstructionFidelityState = {
    ...prev,
    resolvedFacts: facts,
    answeredQuestions: answered,
  };

  return { facts, state, extracted };
}
