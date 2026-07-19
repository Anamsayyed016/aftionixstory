/**
 * Centralized language preference detection + merge for Story Agent.
 * Supports separate narration vs dialogue languages.
 */

export type StoryLanguageCode = "english" | "hindi" | "hinglish";
export type ScriptPreference = "latin" | "devanagari" | "auto";

export type LanguagePreferences = {
  narrationLanguage: StoryLanguageCode;
  dialogueLanguage: StoryLanguageCode;
  scriptPreference: ScriptPreference;
  mirrorUserLanguage: boolean;
};

export type LanguageDetectionResult = {
  matched: boolean;
  /** Partial update from the user message (only fields they mentioned). */
  patch: Partial<LanguagePreferences>;
  /** Full prefs after merge with existing. */
  resolved: LanguagePreferences;
  /** Whether this instruction should revise an existing draft. */
  isRevisionStyleRequest: boolean;
  /** Safe log label, e.g. "hinglish_both" | "dialogue_hinglish". */
  detectedLabel: string;
};

const DEFAULT_PREFS: LanguagePreferences = {
  narrationLanguage: "english",
  dialogueLanguage: "english",
  scriptPreference: "auto",
  mirrorUserLanguage: true,
};

function normalizeCode(raw: string | null | undefined): StoryLanguageCode | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (/hinglish|hindi\s*-?\s*english|english\s*-?\s*hindi|mix/.test(t)) {
    return "hinglish";
  }
  if (/^hi(ndi)?$|हिंदी|हिन्दी/.test(t) || t === "hindi") return "hindi";
  if (/^en(g(lish)?)?$/.test(t) || t === "english") return "english";
  if (t.includes("hinglish")) return "hinglish";
  if (t.includes("hindi")) return "hindi";
  if (t.includes("english")) return "english";
  return null;
}

/** Read prefs already stored on conversation memory. */
export function readLanguagePreferences(input: {
  narrationLanguage?: string | null;
  dialogueLanguage?: string | null;
  scriptPreference?: string | null;
  mirrorUserLanguage?: boolean | null;
  storyLanguage?: string | null;
}): LanguagePreferences {
  const fromDialogue = normalizeCode(input.dialogueLanguage);
  const fromNarration = normalizeCode(input.narrationLanguage);
  const fromStory = normalizeCode(input.storyLanguage);

  const script =
    input.scriptPreference === "latin" ||
    input.scriptPreference === "devanagari" ||
    input.scriptPreference === "auto"
      ? input.scriptPreference
      : fromNarration === "hindi" || fromDialogue === "hindi"
        ? "devanagari"
        : fromNarration === "hinglish" || fromDialogue === "hinglish"
          ? "latin"
          : DEFAULT_PREFS.scriptPreference;

  return {
    narrationLanguage:
      fromNarration ?? fromStory ?? DEFAULT_PREFS.narrationLanguage,
    dialogueLanguage:
      fromDialogue ?? fromNarration ?? fromStory ?? DEFAULT_PREFS.dialogueLanguage,
    scriptPreference: script,
    mirrorUserLanguage:
      typeof input.mirrorUserLanguage === "boolean"
        ? input.mirrorUserLanguage
        : DEFAULT_PREFS.mirrorUserLanguage,
  };
}

/** Merge partial update without wiping unspecified fields with empties. */
export function mergeLanguagePreferences(
  current: LanguagePreferences,
  patch: Partial<LanguagePreferences>
): LanguagePreferences {
  return {
    narrationLanguage: patch.narrationLanguage ?? current.narrationLanguage,
    dialogueLanguage: patch.dialogueLanguage ?? current.dialogueLanguage,
    scriptPreference: patch.scriptPreference ?? current.scriptPreference,
    mirrorUserLanguage:
      typeof patch.mirrorUserLanguage === "boolean"
        ? patch.mirrorUserLanguage
        : current.mirrorUserLanguage,
  };
}

function onlyDialogues(text: string): boolean {
  return (
    /\bdialogues?\b/i.test(text) &&
    !/\bnarration\b/i.test(text) &&
    !/\b(sab|sabhi|full|pure|poori|poora|entire)\b/i.test(text)
  );
}

function onlyNarration(text: string): boolean {
  return (
    /\bnarration\b/i.test(text) &&
    !/\bdialogues?\b/i.test(text)
  );
}

/**
 * Detect language instructions from natural English / Hindi / Hinglish.
 */
export function detectLanguageInstruction(
  userMessage: string,
  existing?: LanguagePreferences | null
): LanguageDetectionResult {
  const text = userMessage.trim();
  const current = existing ?? DEFAULT_PREFS;
  const patch: Partial<LanguagePreferences> = {};
  let detectedLabel = "none";
  let matched = false;

  const mixedEnglishNarrHinglishDlg =
    /\benglish\s+narration\b.*\bhinglish\s+dialogues?\b/i.test(text) ||
    /\bnarration\s+english\b.*\bdialogues?\s+hinglish\b/i.test(text) ||
    (/\bnarration\s+english\s+rakh/i.test(text) && /\bhinglish\b/i.test(text));

  const mixedHindiNarrHinglishDlg =
    /\bhindi\s+narration\b.*\bhinglish\b/i.test(text) ||
    /\bnarration\s+hindi\b.*\bdialogues?\s+(english|hinglish)\b/i.test(text);

  if (mixedEnglishNarrHinglishDlg) {
    matched = true;
    patch.narrationLanguage = "english";
    patch.dialogueLanguage = "hinglish";
    patch.scriptPreference = "latin";
    patch.mirrorUserLanguage = false;
    detectedLabel = "english_narration_hinglish_dialogue";
  } else if (mixedHindiNarrHinglishDlg) {
    matched = true;
    patch.narrationLanguage = "hindi";
    patch.dialogueLanguage = /\benglish\b/i.test(text) ? "english" : "hinglish";
    patch.scriptPreference = "auto";
    patch.mirrorUserLanguage = false;
    detectedLabel = "hindi_narration_mixed_dialogue";
  } else if (
    /\bhinglish\b/i.test(text) ||
    /\bhindi\s+english\s+mix\b/i.test(text) ||
    /\bnormal\s+human\s+hinglish\b/i.test(text)
  ) {
    matched = true;
    patch.mirrorUserLanguage = false;
    patch.scriptPreference = "latin";
    if (onlyDialogues(text)) {
      patch.dialogueLanguage = "hinglish";
      detectedLabel = "dialogue_hinglish";
    } else if (onlyNarration(text)) {
      patch.narrationLanguage = "hinglish";
      detectedLabel = "narration_hinglish";
    } else {
      patch.narrationLanguage = "hinglish";
      patch.dialogueLanguage = "hinglish";
      detectedLabel = "hinglish_both";
    }
  } else if (
    /\bpure\s+hindi\b/i.test(text) ||
    /\bhindi\s+(me|mein)\b/i.test(text) ||
    /\bhindi\s+narration\b/i.test(text) ||
    /\b(hindi|हिंदी|हिन्दी)\s*(me|mein)?\s*(likho|chahiye|rewrite)/i.test(text)
  ) {
    matched = true;
    patch.mirrorUserLanguage = false;
    patch.scriptPreference = "devanagari";
    if (onlyDialogues(text)) {
      patch.dialogueLanguage = "hindi";
      detectedLabel = "dialogue_hindi";
    } else {
      patch.narrationLanguage = "hindi";
      patch.dialogueLanguage = "hindi";
      detectedLabel = "hindi_both";
    }
  } else if (
    /\bpure\s+english\b/i.test(text) ||
    /\benglish\s+(me|mein)\b/i.test(text) ||
    /\bwrite\s+in\s+english\b/i.test(text) ||
    /\benglish\s+prose\b/i.test(text) ||
    /\benglish\s+me\s+rewrite\b/i.test(text)
  ) {
    matched = true;
    patch.mirrorUserLanguage = false;
    patch.scriptPreference = "latin";
    if (onlyDialogues(text)) {
      patch.dialogueLanguage = "english";
      detectedLabel = "dialogue_english";
    } else {
      patch.narrationLanguage = "english";
      patch.dialogueLanguage = "english";
      detectedLabel = "english_both";
    }
  }

  const resolved = mergeLanguagePreferences(current, patch);

  return {
    matched,
    patch,
    resolved,
    isRevisionStyleRequest: matched,
    detectedLabel,
  };
}

/** True when message is primarily a language/style change request. */
export function isLanguagePreferenceMessage(userMessage: string): boolean {
  return detectLanguageInstruction(userMessage).matched;
}

/** Human-readable instruction block for creative prompts. */
export function formatLanguagePromptBlock(prefs: LanguagePreferences): string {
  const script =
    prefs.scriptPreference === "devanagari"
      ? "Prefer Devanagari script for Hindi text."
      : prefs.scriptPreference === "latin"
        ? "Use Latin script (Romanized) unless Devanagari is explicitly required."
        : "Choose script naturally for the languages below.";

  const same =
    prefs.narrationLanguage === prefs.dialogueLanguage
      ? `Write the entire scene in natural ${prefs.narrationLanguage}.`
      : `Narration language: ${prefs.narrationLanguage}. Dialogue language: ${prefs.dialogueLanguage}.`;

  const hinglishHint =
    prefs.narrationLanguage === "hinglish" ||
    prefs.dialogueLanguage === "hinglish"
      ? "Hinglish must sound like natural spoken mix (e.g. “Tum theek ho?” / “I didn’t expect this”). Avoid stiff formal English-only prose. Do not translate character names."
      : "";

  return [same, script, hinglishHint].filter(Boolean).join("\n");
}

/** Display label for storyMemory.language (wizard / create mapping). */
export function languagePrefsToStoryLanguageLabel(
  prefs: LanguagePreferences
): string {
  if (
    prefs.narrationLanguage === "hinglish" ||
    prefs.dialogueLanguage === "hinglish"
  ) {
    if (
      prefs.narrationLanguage === "english" &&
      prefs.dialogueLanguage === "hinglish"
    ) {
      return "English narration, Hinglish dialogues";
    }
    return "Hinglish";
  }
  if (
    prefs.narrationLanguage === "hindi" ||
    prefs.dialogueLanguage === "hindi"
  ) {
    return "Hindi";
  }
  return "English";
}

/**
 * Lightweight compliance check — no second AI call.
 * Returns false when output clearly ignores hinglish/hindi instruction.
 */
export function checkLanguageCompliance(
  content: string,
  prefs: LanguagePreferences
): { ok: boolean; reason: string } {
  const text = content.trim();
  if (text.length < 80) {
    return { ok: false, reason: "too_short" };
  }

  const needsHinglish =
    prefs.narrationLanguage === "hinglish" ||
    prefs.dialogueLanguage === "hinglish";
  const needsHindi =
    prefs.narrationLanguage === "hindi" || prefs.dialogueLanguage === "hindi";

  if (!needsHinglish && !needsHindi) {
    return { ok: true, reason: "english_ok" };
  }

  if (needsHindi && prefs.scriptPreference === "devanagari") {
    const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
    if (devanagari < 20) {
      return { ok: false, reason: "missing_devanagari" };
    }
    return { ok: true, reason: "hindi_ok" };
  }

  if (needsHinglish) {
    const hinglishMarkers =
      /\b(hai|hain|nahi|nahin|kya|kyun|kyunki|aur|lekin|par|toh|to|main|mein|tum|aap|hum|yeh|woh|accha|theek|bahut|thoda|mat|chahiye|raha|rahi|rahe|gaya|gayi|bola|boli|samajh|pasand|dil|yaar)\b/gi;
    const hits = text.match(hinglishMarkers) || [];
    // Allow natural variation — require a modest mix, not every sentence
    if (hits.length < 4) {
      return { ok: false, reason: "missing_hinglish_mix" };
    }
    return { ok: true, reason: "hinglish_ok" };
  }

  return { ok: true, reason: "ok" };
}
