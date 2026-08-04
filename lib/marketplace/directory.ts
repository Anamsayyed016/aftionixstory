/**
 * Curated browse categories for /directory.
 * Matching is substring against Business.category (free text) — no fake taxonomy DB.
 */

export type DirectoryCategory = {
  id: string;
  label: string;
  /** Case-insensitive substrings matched against Business.category */
  match: string[];
};

export const DIRECTORY_CATEGORIES: DirectoryCategory[] = [
  { id: "restaurants", label: "Restaurants", match: ["restaurant", "food", "cafe", "café", "dining"] },
  { id: "fashion", label: "Fashion", match: ["fashion", "clothing", "apparel", "boutique"] },
  { id: "electronics", label: "Electronics", match: ["electronic", "gadget", "mobile", "computer"] },
  { id: "beauty", label: "Beauty", match: ["beauty", "salon", "spa", "cosmetic"] },
  { id: "healthcare", label: "Healthcare", match: ["health", "clinic", "doctor", "dental", "medical"] },
  { id: "education", label: "Education", match: ["educat", "school", "tutor", "coaching", "training"] },
  { id: "home-services", label: "Home Services", match: ["home", "repair", "plumbing", "cleaning", "service"] },
  { id: "print", label: "Print & Design", match: ["print", "design", "creative", "studio"] },
];

export function matchDirectoryCategory(
  category: string | null | undefined,
  curated: DirectoryCategory
): boolean {
  const raw = (category || "").toLowerCase();
  if (!raw) return false;
  return curated.match.some((m) => raw.includes(m.toLowerCase()));
}

export function normalizeCityQuery(city: string | undefined | null): string {
  return (city || "").trim().replace(/\s+/g, " ").slice(0, 80);
}
