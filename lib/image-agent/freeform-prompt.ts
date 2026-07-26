const TRIGGER_PHRASE = /\b(generate|create|make|design|produce|render)\s+(me\s+)?(an?\s+)?(image|picture|photo|photograph|artwork|illustration|drawing|avatar|logo|pic)\s*(of|for|showing|depicting)?\b/gi;
const DRAW_TRIGGER = /\bdraw\s+(me\s+)?(an?\s+)?/gi;
const FILLER_WORDS =
  /\b(i want to|i'd like to|i wanna|please|can you|could you|would you)\b/gi;

/** Strips generic "generate an image of..." / "draw..." framing to isolate the subject. */
export function extractImagePromptSubject(text: string): string {
  return text
    .replace(TRIGGER_PHRASE, "")
    .replace(DRAW_TRIGGER, "")
    .replace(FILLER_WORDS, "")
    .trim();
}

const MIN_SUBJECT_LENGTH = 8;

/** True when there isn't enough descriptive content to generate from yet. */
export function isVagueImagePrompt(text: string): boolean {
  return extractImagePromptSubject(text).length < MIN_SUBJECT_LENGTH;
}
