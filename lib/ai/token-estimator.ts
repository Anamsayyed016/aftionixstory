/** Rough character→token estimate for logging (not billing-grade). */
export function estimateTokensFromCharacters(characters: number): number {
  if (characters <= 0) return 0;
  return Math.max(1, Math.ceil(characters / 4));
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function truncateToBudget(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}
