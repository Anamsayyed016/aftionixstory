/**
 * Pure business-field extraction + draft merge (no DB / server-only).
 * Used by the business agent and unit tests.
 */

export type BusinessDraft = {
  name?: string;
  summary?: string;
  category?: string;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s()-]{7,}\d)/;

function cleanValue(raw: string): string {
  return raw
    .replace(/^[\s:;=\-–—]+/, "")
    .replace(/[\s,;]+$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

/** Labeled fields: "name - hoor", "location: banswara", "email=x@y.com" */
function extractLabeledFields(text: string): BusinessDraft {
  const draft: BusinessDraft = {};
  const labelPatterns: Array<{
    key: keyof BusinessDraft;
    re: RegExp;
  }> = [
    {
      key: "name",
      re: /\b(?:business\s*name|name|biz(?:ness)?)\s*[-:=–—]\s*([^,;\n]+)/i,
    },
    {
      key: "location",
      re: /\b(?:location|based|city|place|address)\s*[-:=–—]\s*([^,;\n]+)/i,
    },
    {
      key: "category",
      re: /\b(?:category|type|industry|field|work)\s*[-:=–—]\s*([^,;\n]+)/i,
    },
    {
      key: "summary",
      re: /\b(?:summary|about|description|we do)\s*[-:=–—]\s*([^,;\n]+)/i,
    },
    {
      key: "contactEmail",
      re: /\b(?:contact\s*)?e-?mail\s*[-:=–—]\s*([^,;\n]+)/i,
    },
    {
      key: "contactPhone",
      re: /\b(?:contact\s*)?phone\s*[-:=–—]\s*([^,;\n]+)/i,
    },
  ];

  for (const { key, re } of labelPatterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const value = cleanValue(m[1]);
    if (!value) continue;
    if (key === "contactEmail" && !EMAIL_RE.test(value)) continue;
    (draft as Record<string, string>)[key] = value.slice(0, key === "summary" ? 600 : 120);
  }
  return draft;
}

/**
 * Informal comma/list style: "software developer, hoor, anamsayyed58@gmail.com"
 * Heuristic: email → contact; remaining parts → category then name (or name then category).
 */
function extractCommaListDraft(text: string): BusinessDraft {
  const draft: BusinessDraft = {};
  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) draft.contactEmail = emailMatch[0];

  const phoneMatch = text.match(PHONE_RE);
  if (phoneMatch) {
    draft.contactPhone = phoneMatch[0].replace(/\s+/g, " ").trim();
  }

  // Strip email/phone before splitting
  const rest = text
    .replace(EMAIL_RE, " ")
    .replace(PHONE_RE, " ")
    .replace(/\b(?:contact\s*)?(?:e-?mail|phone)\b/gi, " ");

  const parts = rest
    .split(/[,|/;]+/)
    .map((p) => cleanValue(p))
    .filter((p) => p.length >= 2 && !/^(and|or|the|a|an)$/i.test(p));

  if (parts.length === 0) return draft;

  // Single leftover token after contact → treat as name (user answering "what's the name?")
  if (parts.length === 1) {
    draft.name = parts[0]!.slice(0, 120);
    return draft;
  }

  // Two+: prefer shorter token as name, longer as category (e.g. "software developer, hoor")
  const sorted = [...parts].sort((a, b) => a.length - b.length);
  const nameCandidate = sorted[0]!;
  const categoryCandidate = sorted[sorted.length - 1]!;
  if (nameCandidate && nameCandidate.length <= 40) {
    draft.name = nameCandidate.slice(0, 120);
  }
  if (
    categoryCandidate &&
    categoryCandidate.toLowerCase() !== draft.name?.toLowerCase()
  ) {
    draft.category = categoryCandidate.slice(0, 60);
  }

  // If three+ parts and middle looks like a place, use as location
  if (parts.length >= 3) {
    const middle = parts[1]!;
    if (
      middle.length <= 40 &&
      middle.toLowerCase() !== draft.name?.toLowerCase() &&
      middle.toLowerCase() !== draft.category?.toLowerCase()
    ) {
      draft.location = middle.slice(0, 80);
    }
  }

  return draft;
}

/** Heuristic extraction from a freeform chat message. */
export function extractBusinessDraft(message: string): BusinessDraft {
  const text = message.trim();
  if (!text) return {};

  const draft: BusinessDraft = {};

  // 1) Explicit "my business is called X"
  const nameMatch =
    text.match(
      /\b(?:my business|business|shop|store|company)\s+(?:is|called|named)\s+["']?([^"'.,\n]+)["']?/i
    ) ||
    text.match(/\blist\s+(?:my\s+)?(?:business|shop)\s+["']?([^"'.,\n]+)["']?/i);
  if (nameMatch?.[1]) draft.name = cleanValue(nameMatch[1]).slice(0, 120);

  // 2) Labeled fields (name - hoor, location- banswara) — win over weaker guesses
  const labeled = extractLabeledFields(text);
  for (const key of Object.keys(labeled) as Array<keyof BusinessDraft>) {
    if (labeled[key]) draft[key] = labeled[key];
  }

  // 3) Email / phone anywhere
  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) draft.contactEmail = emailMatch[0];
  const phoneMatch = text.match(PHONE_RE);
  if (phoneMatch) {
    draft.contactPhone = phoneMatch[0].replace(/\s+/g, " ").trim();
  }

  // 4) "in/at/based in LOCATION" if location still missing
  if (!draft.location) {
    const locMatch = text.match(
      /\b(?:in|at|based in|located in)\s+([A-Za-z][A-Za-z\s-]{1,40})/i
    );
    if (locMatch?.[1] && !/need|looking|someone/i.test(locMatch[1])) {
      draft.location = cleanValue(locMatch[1]).slice(0, 80);
    }
  }

  // 5) Category phrases
  if (!draft.category) {
    const catMatch = text.match(
      /\b(?:category|type|we (?:are|do|sell)|we'?re a)\s+([A-Za-z][A-Za-z\s&-]{1,40})/i
    );
    if (catMatch?.[1]) draft.category = cleanValue(catMatch[1]).slice(0, 60);
  }

  // 6) Informal comma lists when name still missing
  if (!draft.name || (!draft.category && text.includes(","))) {
    const comma = extractCommaListDraft(text);
    if (!draft.name && comma.name) draft.name = comma.name;
    if (!draft.category && comma.category) draft.category = comma.category;
    if (!draft.location && comma.location) draft.location = comma.location;
    if (!draft.contactEmail && comma.contactEmail) {
      draft.contactEmail = comma.contactEmail;
    }
    if (!draft.contactPhone && comma.contactPhone) {
      draft.contactPhone = comma.contactPhone;
    }
  }

  // 7) Summary from longer free text (don't overwrite a labeled summary)
  if (!draft.summary && text.length > 40) {
    if (!/\bname\s*[-:=]/i.test(text) || text.length > 80) {
      draft.summary = text.slice(0, 600);
    }
  }

  return draft;
}

export function mergeBusinessDrafts(
  ...drafts: Array<BusinessDraft | null | undefined>
): BusinessDraft {
  const out: BusinessDraft = {};
  for (const d of drafts) {
    if (!d) continue;
    if (d.name?.trim()) out.name = d.name.trim();
    if (d.summary?.trim()) out.summary = d.summary.trim();
    if (d.category?.trim()) out.category = d.category.trim();
    if (d.location?.trim()) out.location = d.location.trim();
    if (d.contactEmail?.trim()) out.contactEmail = d.contactEmail.trim();
    if (d.contactPhone?.trim()) out.contactPhone = d.contactPhone.trim();
  }
  return out;
}

export function draftHasAnyField(draft: BusinessDraft): boolean {
  return Boolean(
    draft.name ||
      draft.summary ||
      draft.category ||
      draft.location ||
      draft.contactEmail ||
      draft.contactPhone
  );
}

export function missingBusinessFields(draft: BusinessDraft): string[] {
  const missing: string[] = [];
  if (!draft.name?.trim()) missing.push("business name");
  if (!draft.contactEmail?.trim()) missing.push("contact email");
  if (!draft.location?.trim()) missing.push("location");
  return missing;
}

export function readBusinessDraftFromState(state: unknown): BusinessDraft {
  if (!state || typeof state !== "object") return {};
  const root = state as Record<string, unknown>;
  const marketplace = root.marketplace;
  if (!marketplace || typeof marketplace !== "object") return {};
  const draft = (marketplace as Record<string, unknown>).businessDraft;
  if (!draft || typeof draft !== "object") return {};
  const d = draft as Record<string, unknown>;
  return {
    name: typeof d.name === "string" ? d.name : undefined,
    summary: typeof d.summary === "string" ? d.summary : undefined,
    category: typeof d.category === "string" ? d.category : undefined,
    location: typeof d.location === "string" ? d.location : undefined,
    contactEmail:
      typeof d.contactEmail === "string" ? d.contactEmail : undefined,
    contactPhone:
      typeof d.contactPhone === "string" ? d.contactPhone : undefined,
  };
}

export function withBusinessDraftInState(
  previous: unknown,
  draft: BusinessDraft
): Record<string, unknown> {
  const base =
    previous && typeof previous === "object"
      ? { ...(previous as Record<string, unknown>) }
      : {};
  const marketplace =
    base.marketplace && typeof base.marketplace === "object"
      ? { ...(base.marketplace as Record<string, unknown>) }
      : {};
  marketplace.businessDraft = draft;
  base.marketplace = marketplace;
  return base;
}

export function formatCaptured(draft: BusinessDraft): string {
  const bits: string[] = [];
  if (draft.name) bits.push(`name: ${draft.name}`);
  if (draft.category) bits.push(`category: ${draft.category}`);
  if (draft.location) bits.push(`location: ${draft.location}`);
  if (draft.contactEmail) bits.push(`email: ${draft.contactEmail}`);
  if (draft.contactPhone) bits.push(`phone: ${draft.contactPhone}`);
  return bits.join("; ");
}
