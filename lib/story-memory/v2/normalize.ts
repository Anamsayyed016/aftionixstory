/**
 * Normalization helpers for Memory v2 (names, keys, IDs, rule text).
 */

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeLocationKey(name: string): string {
  return normalizeKey(name.replace(/[.,]/g, " "));
}

/** Collapse near-duplicate writing rule phrases. */
export function normalizeRuleText(rule: string): string {
  return rule
    .trim()
    .toLowerCase()
    .replace(/^(use|please|always|prefer)\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}

export function stableId(prefix: string, key: string): string {
  const k = normalizeKey(key) || "unknown";
  return `${prefix}_${k}`.slice(0, 96);
}

export function newEntityId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function dedupeStrings(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}
