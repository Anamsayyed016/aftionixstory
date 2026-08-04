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

/** Canned “list my business” prompts / meta intent — not real details. */
const META_LISTING_RE =
  /^(list my business on the directory\.?\s*(i'?ll share.*)?)|(i want to list my business[,.]?\s*i'?ll share details\.?)|(list my business\.?)|(add my (business|shop)\.?)$/i;

const JUNK_NAME_RE =
  /\b(on the directory|i'?ll share details|list my business|share the name|what we do|directory|details|location and contact)\b/i;

const JUNK_LOCATION_TOKENS = new Set([
  "ad",
  "ads",
  "advert",
  "adverts",
  "advertisement",
  "advertising",
  "do",
  "we",
  "what",
  "details",
  "detail",
  "directory",
  "name",
  "email",
  "phone",
  "location",
  "category",
  "summary",
  "contact",
  "business",
  "shop",
  "store",
  "share",
  "here",
  "there",
  "this",
  "that",
]);

function cleanValue(raw: string): string {
  return raw
    .replace(/^[\s:;=\-–—]+/, "")
    .replace(/[\s,;]+$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * True when the message is an intent / starter prompt, not actual business facts.
 * Exact canned prompts from studio starters / constants, or listing-intent with
 * no email / labels / “called X” signal.
 */
export function isBusinessListingMetaMessage(message: string): boolean {
  const t = message.trim();
  if (!t) return true;
  if (META_LISTING_RE.test(t)) return true;

  const hasEmail = EMAIL_RE.test(t);
  const hasLabeled = /\b(?:name|location|category|email|phone)\s*[-:=]/i.test(
    t
  );
  const hasCalled =
    /\b(?:called|named)\s+[A-Za-z][A-Za-z0-9&\s-]{1,60}/i.test(t);
  const mentionsListingIntent =
    /\b(list my business|add my (business|shop)|i'?ll share (the )?(name|details|what we do|location|contact)|share the name, what we do)\b/i.test(
      t
    );

  return (
    mentionsListingIntent && !hasEmail && !hasLabeled && !hasCalled
  );
}

export function isPlausibleBusinessName(name: string | undefined | null): boolean {
  const n = (name || "").trim();
  if (n.length < 2 || n.length > 80) return false;
  if (EMAIL_RE.test(n) || n.includes("@")) return false;
  if (JUNK_NAME_RE.test(n)) return false;
  if (/^(on the directory|i'?ll share details|list my business)$/i.test(n)) {
    return false;
  }
  // Reject pure instruction snippets
  if (/\bi'?ll share\b/i.test(n) || /\bwhat we do\b/i.test(n)) return false;
  const lower = n.toLowerCase();
  if (JUNK_LOCATION_TOKENS.has(lower)) return false;
  return true;
}

export function isPlausibleLocation(location: string | undefined | null): boolean {
  const loc = (location || "").trim();
  if (loc.length < 2 || loc.length > 80) return false;
  const tokens = loc
    .toLowerCase()
    .split(/[\s,/|-]+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  // Single-token junk like "Ads", "do"
  if (tokens.length === 1 && JUNK_LOCATION_TOKENS.has(tokens[0]!)) {
    return false;
  }
  if (tokens.every((t) => JUNK_LOCATION_TOKENS.has(t))) return false;
  if (/^what we do$/i.test(loc)) return false;
  return true;
}

function sanitizeDraft(draft: BusinessDraft): BusinessDraft {
  const out: BusinessDraft = { ...draft };
  if (out.name && !isPlausibleBusinessName(out.name)) delete out.name;
  if (out.location && !isPlausibleLocation(out.location)) delete out.location;
  if (out.summary && isBusinessListingMetaMessage(out.summary)) {
    delete out.summary;
  }
  if (
    out.summary &&
    /\bi'?ll share the name, what we do, location, and contact email\b/i.test(
      out.summary
    )
  ) {
    delete out.summary;
  }
  return out;
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
    (draft as Record<string, string>)[key] = value.slice(
      0,
      key === "summary" ? 600 : 120
    );
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

  const phoneMatch = text.replace(EMAIL_RE, " ").match(PHONE_RE);
  if (phoneMatch) {
    draft.contactPhone = phoneMatch[0].replace(/\s+/g, " ").trim();
  }

  const rest = text
    .replace(EMAIL_RE, " ")
    .replace(PHONE_RE, " ")
    .replace(/\b(?:contact\s*)?(?:e-?mail|phone)\b/gi, " ");

  const parts = rest
    .split(/[,|/;]+/)
    .map((p) => cleanValue(p))
    .filter((p) => p.length >= 2 && !/^(and|or|the|a|an)$/i.test(p));

  if (parts.length === 0) return draft;

  if (parts.length === 1) {
    const only = parts[0]!;
    if (isPlausibleBusinessName(only)) draft.name = only.slice(0, 120);
    return draft;
  }

  // Prefer a short title-like token as name; avoid taking marketing tokens as name.
  const nameCandidate = [...parts]
    .filter((p) => isPlausibleBusinessName(p) && p.length <= 40)
    .sort((a, b) => a.length - b.length)[0];
  const categoryCandidate = [...parts]
    .filter(
      (p) =>
        p.toLowerCase() !== nameCandidate?.toLowerCase() && p.length >= 4
    )
    .sort((a, b) => b.length - a.length)[0];

  if (nameCandidate) draft.name = nameCandidate.slice(0, 120);
  if (categoryCandidate) draft.category = categoryCandidate.slice(0, 60);

  if (parts.length >= 3) {
    const middle = parts[1]!;
    if (
      isPlausibleLocation(middle) &&
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

  // Meta / starter prompts must not invent name/category/location/summary.
  if (isBusinessListingMetaMessage(text)) {
    return {};
  }

  const draft: BusinessDraft = {};

  // 1) Explicit "my business is called X" / "my business is X"
  const nameMatch = text.match(
    /\b(?:my business|business|shop|store|company)\s+(?:is\s+(?:called|named)\s+|called\s+|named\s+|is\s+)["']?([^"'.,\n]+?)["']?(?=[.,\n]|$)/i
  );
  // Avoid the outdated "list my business <junk>" name capture — that matched
  // "on the directory" from the studio starter prompt.
  if (nameMatch?.[1]) {
    const name = cleanValue(nameMatch[1]).slice(0, 120);
    if (isPlausibleBusinessName(name)) draft.name = name;
  }

  // 2) Labeled fields (name - hoor, location- banswara) — win over weaker guesses
  const labeled = extractLabeledFields(text);
  for (const key of Object.keys(labeled) as Array<keyof BusinessDraft>) {
    if (labeled[key]) draft[key] = labeled[key];
  }

  // 3) Email / phone anywhere (strip emails before phone so IDs in addresses
  // don't become phone numbers)
  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) draft.contactEmail = emailMatch[0];
  const phoneMatch = text.replace(EMAIL_RE, " ").match(PHONE_RE);
  if (phoneMatch) {
    draft.contactPhone = phoneMatch[0].replace(/\s+/g, " ").trim();
  }

  // 4) "in/at/based in LOCATION" if location still missing
  if (!draft.location) {
    const locMatch = text.match(
      /\b(?:in|at|based in|located in)\s+([A-Za-z][A-Za-z\s-]{1,40})/i
    );
    if (
      locMatch?.[1] &&
      !/need|looking|someone/i.test(locMatch[1]) &&
      isPlausibleLocation(locMatch[1])
    ) {
      draft.location = cleanValue(locMatch[1]).slice(0, 80);
    }
  }

  // 5) Category phrases
  if (!draft.category) {
    const catMatch = text.match(
      /\b(?:category|type|we (?:are|do|sell)|we'?re a)\s+([A-Za-z][A-Za-z\s&-]{1,40})/i
    );
    if (catMatch?.[1]) {
      const cat = cleanValue(catMatch[1]).slice(0, 60);
      // "we do," without a real category content often captures garbage
      if (!/^(location|name|contact|email)\b/i.test(cat) && cat.length >= 3) {
        draft.category = cat;
      }
    }
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

  // 7) Summary from longer free text — never the listing starter / meta prompt
  if (!draft.summary && text.length > 40 && !isBusinessListingMetaMessage(text)) {
    const looksLikeLabeledOnly =
      /\bname\s*[-:=]/i.test(text) && text.length < 80;
    if (!looksLikeLabeledOnly) {
      // Prefer a descriptive sentence, not the whole chat with email boilerplate
      draft.summary = text.slice(0, 600);
    }
  }

  return sanitizeDraft(draft);
}

export function mergeBusinessDrafts(
  ...drafts: Array<BusinessDraft | null | undefined>
): BusinessDraft {
  const out: BusinessDraft = {};
  for (const d of drafts) {
    if (!d) continue;
    if (d.name?.trim() && isPlausibleBusinessName(d.name)) {
      out.name = d.name.trim();
    }
    if (d.summary?.trim() && !isBusinessListingMetaMessage(d.summary)) {
      out.summary = d.summary.trim();
    }
    if (d.category?.trim()) out.category = d.category.trim();
    if (d.location?.trim() && isPlausibleLocation(d.location)) {
      out.location = d.location.trim();
    }
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
  if (!draft.name?.trim() || !isPlausibleBusinessName(draft.name)) {
    missing.push("business name");
  }
  if (!draft.contactEmail?.trim()) missing.push("contact email");
  if (!draft.location?.trim() || !isPlausibleLocation(draft.location)) {
    missing.push("location");
  }
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
  return sanitizeDraft({
    name: typeof d.name === "string" ? d.name : undefined,
    summary: typeof d.summary === "string" ? d.summary : undefined,
    category: typeof d.category === "string" ? d.category : undefined,
    location: typeof d.location === "string" ? d.location : undefined,
    contactEmail:
      typeof d.contactEmail === "string" ? d.contactEmail : undefined,
    contactPhone:
      typeof d.contactPhone === "string" ? d.contactPhone : undefined,
  });
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
