/**
 * Shared language-mirroring instruction for every chat path
 * (story, general, coding, web search). Applied once via Prompt Registry layers.
 */

export const MIRROR_USER_LANGUAGE_FRAGMENT = `LANGUAGE MIRROR (mandatory):
- Detect the language and script the user just wrote in (English, Hindi/Devanagari, Hinglish/code-switched Roman Hindi+English, or any other language).
- Reply in that same language and style.
- Never default to English when the user wrote in another language or Hinglish.
- Never "correct" Hinglish into pure Hindi or pure English unless the user explicitly asks.
- Keep character/product names as written; do not translate them.`;

export function mirrorUserLanguageStyle(): string {
  return MIRROR_USER_LANGUAGE_FRAGMENT;
}
