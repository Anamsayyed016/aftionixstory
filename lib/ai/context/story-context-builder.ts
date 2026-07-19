import type { StoryOperation } from "@/lib/story-agent/operations";
import type { StoryMemory } from "@/lib/story-agent/schema";
import {
  extractMentionedCharacters,
  resolveSceneRequest,
} from "@/lib/story-agent/entity-resolver";
import {
  detectLanguageInstruction,
  languagePrefsToStoryLanguageLabel,
  readLanguagePreferences,
  type LanguagePreferences,
} from "@/lib/story-agent/language-preferences";

export { extractMentionedCharacters } from "@/lib/story-agent/entity-resolver";

export type CompactStoryContext = {
  operation: StoryOperation;
  conversationId?: string;
  storyId?: string | null;
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
  includeLatestDraft: boolean;
  recentMessages: Array<{ role: string; content: string }>;
  wordTarget?: { min?: number; max?: number };
  namedInRequest: string[];
  actionHints: string[];
  conflictHints: string[];
  settingOverride?: string;
  /** Safe section labels for diagnostics (no content). */
  promptSectionNames: string[];
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
 * Only uses the active conversation's memory + recent messages.
 */
export function buildStoryContext(params: {
  operation: StoryOperation;
  memory: StoryMemory;
  userMessage: string;
  recentMessages?: Array<{ role: string; content: string }>;
  conversationId?: string;
  storyId?: string | null;
}): CompactStoryContext {
  const { operation, memory, userMessage } = params;

  // Isolation: refuse mismatched draft source when tagged
  const draftSource = (
    memory.latestDraft as { sourceConversationId?: string } | null | undefined
  )?.sourceConversationId;
  if (
    params.conversationId &&
    draftSource &&
    draftSource !== params.conversationId
  ) {
    throw new Error("CONTEXT_ISOLATION_ERROR");
  }

  const resolved = resolveSceneRequest(userMessage, memory);
  const mentioned = extractMentionedCharacters(userMessage);
  const namedInRequest =
    resolved.characterNames.length > 0
      ? resolved.characterNames
      : mentioned.map((c) => c.name);

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
  // Ensure resolved names exist even if extractor casing differed
  for (const name of namedInRequest) {
    const key = name.toLowerCase();
    if (!charMap.has(key)) {
      charMap.set(key, {
        name,
        personality: [],
        goals: [],
        conflicts: [],
        notes: [],
        avoid: [],
      });
    }
  }

  let characters = Array.from(charMap.values()).map((c) => ({
    name: c.name,
    role: c.role ?? undefined,
    personality: c.personality ?? [],
    avoid: c.avoid ?? [],
    notes: c.notes ?? [],
  }));

  // Fresh write_scene: current request characters win — drop unrelated cast
  const isCreativeWrite =
    operation === "write_scene" ||
    operation === "start_story" ||
    operation === "generate_episode";
  if (isCreativeWrite && namedInRequest.length > 0) {
    const preferred = characters.filter((c) =>
      namedInRequest.some((n) => n.toLowerCase() === c.name.toLowerCase())
    );
    if (preferred.length > 0) characters = preferred;
  } else if (operation === "revise_draft" && namedInRequest.length > 0) {
    const preferred = characters.filter((c) =>
      namedInRequest.some((n) => n.toLowerCase() === c.name.toLowerCase())
    );
    if (preferred.length > 0) characters = preferred;
  }

  const nameSet = new Set(characters.map((c) => c.name.toLowerCase()));
  let relationships = memory.relationships.map((r) => ({
    from: r.from,
    to: r.to,
    type: r.type,
    notes: r.notes ?? undefined,
  }));
  if (isCreativeWrite && namedInRequest.length > 0) {
    relationships = relationships.filter(
      (r) =>
        nameSet.has(r.from.toLowerCase()) || nameSet.has(r.to.toLowerCase())
    );
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

  // Only include previous draft for revise/continue — never for fresh write_scene
  const includeLatestDraft =
    Boolean(memory.latestDraft?.content) &&
    (operation === "revise_draft" || operation === "continue_episode");

  const draftContent = memory.latestDraft?.content;
  const latestDraftPreview =
    includeLatestDraft && draftContent
      ? draftContent.slice(0, operation === "revise_draft" ? 12000 : 2000)
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

  // When request names different leads, do not let an old title/concept dominate
  const memoryCast = memory.characters.map((c) => c.name.toLowerCase());
  const requestCast = namedInRequest.map((n) => n.toLowerCase());
  const castConflict =
    requestCast.length > 0 &&
    memoryCast.length > 0 &&
    !requestCast.some((n) => memoryCast.includes(n));

  const setting =
    resolved.settingOverride ||
    (castConflict && isCreativeWrite
      ? undefined
      : memory.storyMemory.setting);

  const promptSectionNames = [
    "CURRENT_REQUEST",
    "REQUESTED_CHARACTERS",
    "ACTIVE_STORY_MEMORY",
    "RELATIONSHIPS",
    "STYLE_PREFERENCES",
    "CONSTRAINTS",
    "OUTPUT_REQUIREMENTS",
  ];
  if (includeLatestDraft) promptSectionNames.push("LATEST_DRAFT");

  return {
    operation,
    conversationId: params.conversationId,
    storyId: params.storyId ?? null,
    userInstruction: userMessage,
    languageHint: detectLanguageHint(userMessage, memory),
    languagePrefs,
    concept: castConflict && isCreativeWrite ? undefined : memory.storyMemory.concept,
    title: castConflict && isCreativeWrite ? undefined : memory.storyMemory.title,
    genre: memory.storyMemory.genre ?? [],
    tone: memory.storyMemory.tone ?? [],
    setting,
    plot: castConflict && isCreativeWrite ? undefined : memory.storyMemory.plot,
    pov: memory.storyMemory.pov,
    pacing: memory.storyMemory.pacing,
    writingStyle: memory.storyMemory.writingStyle,
    characters,
    relationships,
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
    includeLatestDraft,
    recentMessages,
    wordTarget: extractWordTarget(userMessage),
    namedInRequest,
    actionHints: resolved.actionHints,
    conflictHints: resolved.conflictHints,
    settingOverride: resolved.settingOverride,
    promptSectionNames,
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
