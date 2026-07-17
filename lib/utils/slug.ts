/**
 * Server-side slug generation. Never trust client-provided slugs.
 */
export function slugifyTitle(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || "story";
}

export function withSlugSuffix(base: string, n: number): string {
  if (n <= 1) return base;
  return `${base}-${n}`;
}
