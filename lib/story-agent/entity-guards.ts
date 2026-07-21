/**
 * Shared safeguards for names that can enter story memory or be displayed as
 * story characters. These words commonly occur in UI copy, feedback, or
 * writing instructions and must never become canon on their own.
 */
export const RESERVED_PSEUDO_ENTITY_NAMES = new Set(
  [
    "business",
    "baat",
    "updated",
    "got",
    "hinglish",
    "rewrite",
    "continue",
    "helpful",
    "feedback",
    "draft",
    "story",
    "scene",
    "episode",
    "title",
    "optional",
    "using",
    "saved",
    "unsaved",
    "emotional",
    "romantic",
    "funny",
    "dark",
    "uppercase",
    "dialogue",
    "dialogues",
    "language",
    "english",
    "hindi",
  ].map((value) => value.toLowerCase())
);

const GENERIC_NON_NAMES = new Set(
  [
    "the",
    "a",
    "an",
    "and",
    "or",
    "character",
    "characters",
    "role",
    "lead",
    "hero",
    "heroine",
    "protagonist",
    "antagonist",
    "father",
    "mother",
    "uncle",
    "aunt",
    "daughter",
    "son",
    "brother",
    "sister",
    "friend",
    "remove",
    "delete",
    "build",
    "create",
    "write",
    "make",
    "please",
    "continue",
    "start",
    "new",
    "main",
    "with",
    "from",
    "between",
    "about",
    "this",
    "that",
    "their",
  ].map((value) => value.toLowerCase())
);

export function isReservedPseudoEntityName(value: string): boolean {
  return RESERVED_PSEUDO_ENTITY_NAMES.has(value.trim().toLowerCase());
}

/** A lexical guard; callers still need an explicit person-context signal. */
export function isValidCanonicalEntityName(value: string): boolean {
  const name = value.trim();
  if (name.length < 2 || name.length > 64) return false;
  if (/'s$/i.test(name)) return false;
  if (isReservedPseudoEntityName(name)) return false;
  if (GENERIC_NON_NAMES.has(name.toLowerCase())) return false;
  return /^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,3}$/.test(name);
}
