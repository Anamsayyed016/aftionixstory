import type { StoryOperation } from "@/lib/story-agent/operations";
import type { StoryMemory } from "@/lib/story-agent/schema";
import {
  detectLanguageInstruction,
  languagePrefsToStoryLanguageLabel,
  readLanguagePreferences,
  type LanguagePreferences,
} from "@/lib/story-agent/language-preferences";

export type CompactStoryContext = {
  operation: StoryOperation;
  userInstruction: string;
  languageHint: string;
  languagePrefs: LanguagePreferences;
  concept?: string;
  title?: string;
  genre: string[];
  tone: string[];
  setting?: string;
  plot?: string;
  pov?: string;
  pacing?: string;
  writingStyle?: string;
  characters: Array<{
    name: string;
    role?: string;
    personality: string[];
    avoid: string[];
    notes: string[];
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    notes?: string;
  }>;
  writingRules: string[];
  preferences: {
    dialogueLanguage?: string;
    narrationLanguage?: string;
    uppercaseForLoudDialogue: boolean;
    slowBurn: boolean;
    avoid: string[];
  };
  latestDraftPreview?: string;
  recentMessages: Array<{ role: string; content: string }>;
  wordTarget?: { min?: number; max?: number };
  namedInRequest: string[];
};

/** Pull length hints like 300–500 words from the user message. */
export function extractWordTarget(
  message: string
): { min?: number; max?: number } | undefined {
  const range = message.match(
    /(\d{2,4})\s*[-–—]\s*(\d{2,4})\s*words?/i
  );
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }
  const single = message.match(/\b(\d{2,4})\s*words?\b/i);
  if (single) {
    const n = Number(single[1]);
    return { min: Math.floor(n * 0.85), max: Math.ceil(n * 1.15) };
  }
  return undefined;
}

/**
 * Lightweight character mentions from free text, e.g.
 * "between Azar (college owner) and Anaya (student)"
 */
export function extractMentionedCharacters(
  message: string
): Array<{ name: string; role?: string }> {
  const found: Array<{ name: string; role?: string }> = [];
  const withRole =
    /\b([A-Z][a-zA-Z]{1,30})\s*\(([^)]{1,80})\)/g;
  let m: RegExpExecArray | null;
  while ((m = withRole.exec(message)) !== null) {
    found.push({ name: m[1], role: m[2].trim() });
  }

  const between = message.match(
    /\bbetween\s+([A-Z][a-zA-Z]{1,30})(?:\s*\([^)]*\))?\s+and\s+([A-Z][a-zA-Z]{1,30})/i
  );
  if (between) {
    for (const name of [between[1], between[2]]) {
      if (!found.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        found.push({ name });
      }
    }
  }

  return found;
}

function detectLanguageHint(message: string, memory: StoryMemory): string {
  const prefs = readLanguagePreferences({
    narrationLanguage: memory.userPreferences.narrationLanguage,
    dialogueLanguage: memory.userPreferences.dialogueLanguage,
    scriptPreference: memory.userPreferences.scriptPreference,
    mirrorUserLanguage: memory.userPreferences.mirrorUserLanguage,
    storyLanguage: memory.storyMemory.language,
  });
  const detected = detectLanguageInstruction(message, prefs);
  if (detected.matched) {
    return languagePrefsToStoryLanguageLabel(detected.resolved);
  }
  if (!prefs.mirrorUserLanguage) {
    return languagePrefsToStoryLanguageLabel(prefs);
  }
  if (memory.userPreferences.dialogueLanguage) {
    return memory.userPreferences.dialogueLanguage;
  }
  if (memory.storyMemory.language) return memory.storyMemory.language;
  if (/\bhinglish\b/i.test(message)) return "Hinglish";
  if (/[\u0900-\u097F]/.test(message)) return "Hindi";
  if (
    /\b(hai|nahi|karo|likho|scene|mat|aap|main|ya)\b/i.test(message) &&
    /[a-z]/i.test(message)
  ) {
    return "Hinglish";
  }
  return "mirror user message";
}

/**
 * Builds a compact, operation-scoped context — never the entire DB.
 */
export function buildStoryContext(params: {
  operation: StoryOperation;
  memory: StoryMemory;
  userMessage: string;
  recentMessages?: Array<{ role: string; content: string }>;
}): CompactStoryContext {
  const { operation, memory, userMessage } = params;
  const mentioned = extractMentionedCharacters(userMessage);
  const namedInRequest = mentioned.map((c) => c.name);

  // Merge mentioned roles into character list for creative ops
  const charMap = new Map(
    memory.characters.map((c) => [c.name.toLowerCase(), c])
  );
  for (const m of mentioned) {
    const key = m.name.toLowerCase();
    const existing = charMap.get(key);
    if (!existing) {
      charMap.set(key, {
        name: m.name,
        role: m.role,
        personality: [],
        background: undefined,
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      });
    } else if (m.role && !existing.role) {
      charMap.set(key, { ...existing, role: m.role });
    }
  }

  let characters = Array.from(charMap.values()).map((c) => ({
    name: c.name,
    role: c.role ?? undefined,
    personality: c.personality ?? [],
    avoid: c.avoid ?? [],
    notes: c.notes ?? [],
  }));

  // For write_scene: prefer characters named in the request when present
  if (
    (operation === "write_scene" || operation === "revise_draft") &&
    namedInRequest.length > 0
  ) {
    const preferred = characters.filter((c) =>
      namedInRequest.some((n) => n.toLowerCase() === c.name.toLowerCase())
    );
    if (preferred.length > 0) characters = preferred;
  }

  // Casual chat: compact memory only
  const recentLimit =
    operation === "conversational_chat" || operation === "brainstorm"
      ? 8
      : 12;

  const recentMessages = (params.recentMessages ?? [])
    .slice(-recentLimit)
    .map((m) => ({
      role: m.role,
      content:
        m.content.length > 600 ? `${m.content.slice(0, 600)}…` : m.content,
    }));

  const draftContent = memory.latestDraft?.content;
  const latestDraftPreview =
    operation === "revise_draft" ||
    operation === "continue_episode" ||
    operation === "write_scene"
      ? draftContent
        ? draftContent.slice(0, operation === "revise_draft" ? 12000 : 1200)
        : undefined
      : draftContent
        ? draftContent.slice(0, 400)
        : undefined;

  const basePrefs = readLanguagePreferences({
    narrationLanguage: memory.userPreferences.narrationLanguage,
    dialogueLanguage: memory.userPreferences.dialogueLanguage,
    scriptPreference: memory.userPreferences.scriptPreference,
    mirrorUserLanguage: memory.userPreferences.mirrorUserLanguage,
    storyLanguage: memory.storyMemory.language,
  });
  const langDetect = detectLanguageInstruction(userMessage, basePrefs);
  const languagePrefs = langDetect.matched ? langDetect.resolved : basePrefs;

  return {
    operation,
    userInstruction: userMessage,
    languageHint: detectLanguageHint(userMessage, memory),
    languagePrefs,
    concept: memory.storyMemory.concept,
    title: memory.storyMemory.title,
    genre: memory.storyMemory.genre ?? [],
    tone: memory.storyMemory.tone ?? [],
    setting: memory.storyMemory.setting,
    plot: memory.storyMemory.plot,
    pov: memory.storyMemory.pov,
    pacing: memory.storyMemory.pacing,
    writingStyle: memory.storyMemory.writingStyle,
    characters,
    relationships: memory.relationships.map((r) => ({
      from: r.from,
      to: r.to,
      type: r.type,
      notes: r.notes ?? undefined,
    })),
    writingRules: memory.writingRules.map((r) => r.rule),
    preferences: {
      dialogueLanguage:
        languagePrefs.dialogueLanguage ||
        memory.userPreferences.dialogueLanguage ||
        undefined,
      narrationLanguage: languagePrefs.narrationLanguage,
      uppercaseForLoudDialogue: Boolean(
        memory.userPreferences.uppercaseForLoudDialogue
      ),
      slowBurn: Boolean(memory.userPreferences.slowBurn),
      avoid: memory.userPreferences.avoid ?? [],
    },
    latestDraftPreview,
    recentMessages,
    wordTarget: extractWordTarget(userMessage),
    namedInRequest,
  };
}

/** Seed memory with characters/roles mentioned in the current request. */
export function seedMemoryFromMessage(
  memory: StoryMemory,
  userMessage: string
): StoryMemory {
  const mentioned = extractMentionedCharacters(userMessage);
  if (mentioned.length === 0) return memory;

  const characters = [...memory.characters];
  for (const m of mentioned) {
    const idx = characters.findIndex(
      (c) => c.name.toLowerCase() === m.name.toLowerCase()
    );
    if (idx === -1) {
      characters.push({
        name: m.name,
        role: m.role,
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      });
    } else if (m.role && !characters[idx].role) {
      characters[idx] = { ...characters[idx], role: m.role };
    }
  }

  // Soft concept seed from writing requests
  let concept = memory.storyMemory.concept;
  if (!concept && /\b(romantic|romance|forbidden|horror|fantasy)\b/i.test(userMessage)) {
    const toneMatch = userMessage.match(
      /\b(romantic|romance|forbidden love|horror|fantasy|thriller|comedy)\b/i
    );
    if (toneMatch) {
      concept = `${toneMatch[1]} scene request`;
    }
  }

  const langDetect = detectLanguageInstruction(
    userMessage,
    readLanguagePreferences({
      narrationLanguage: memory.userPreferences.narrationLanguage,
      dialogueLanguage: memory.userPreferences.dialogueLanguage,
      scriptPreference: memory.userPreferences.scriptPreference,
      mirrorUserLanguage: memory.userPreferences.mirrorUserLanguage,
      storyLanguage: memory.storyMemory.language,
    })
  );

  return {
    ...memory,
    characters,
    storyMemory: {
      ...memory.storyMemory,
      concept: concept ?? memory.storyMemory.concept,
      language: langDetect.matched
        ? languagePrefsToStoryLanguageLabel(langDetect.resolved)
        : memory.storyMemory.language,
      genre:
        memory.storyMemory.genre.length > 0
          ? memory.storyMemory.genre
          : /\bromanc/i.test(userMessage)
            ? ["romance"]
            : /\bhorror\b/i.test(userMessage)
              ? ["horror"]
              : /\bfantasy\b/i.test(userMessage)
                ? ["fantasy"]
                : memory.storyMemory.genre,
    },
    userPreferences: langDetect.matched
      ? {
          ...memory.userPreferences,
          narrationLanguage: langDetect.resolved.narrationLanguage,
          dialogueLanguage: langDetect.resolved.dialogueLanguage,
          scriptPreference: langDetect.resolved.scriptPreference,
          mirrorUserLanguage: langDetect.resolved.mirrorUserLanguage,
        }
      : memory.userPreferences,
    updatedAt: new Date().toISOString(),
  };
}
