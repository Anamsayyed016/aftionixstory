import "server-only";

import { prisma } from "@/lib/db";
import { allocateBusinessSlug } from "@/lib/marketplace/slugs";

export type BusinessDraft = {
  name?: string;
  summary?: string;
  category?: string;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
};

/** Heuristic extraction from a freeform chat message. */
export function extractBusinessDraft(message: string): BusinessDraft {
  const text = message.trim();
  const draft: BusinessDraft = {};

  const nameMatch =
    text.match(
      /\b(?:my business|business|shop|store|company)\s+(?:is|called|named)\s+["']?([^"'.,\n]+)["']?/i
    ) ||
    text.match(/\blist\s+(?:my\s+)?(?:business|shop)\s+["']?([^"'.,\n]+)["']?/i);
  if (nameMatch?.[1]) draft.name = nameMatch[1].trim().slice(0, 120);

  const emailMatch = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  if (emailMatch) draft.contactEmail = emailMatch[0];

  const phoneMatch = text.match(
    /(?:\+?\d[\d\s()-]{7,}\d)/
  );
  if (phoneMatch) draft.contactPhone = phoneMatch[0].replace(/\s+/g, " ").trim();

  const locMatch = text.match(
    /\b(?:in|at|based in|located in)\s+([A-Za-z][A-Za-z\s-]{1,40})/i
  );
  if (locMatch?.[1] && !/need|looking|someone/i.test(locMatch[1])) {
    draft.location = locMatch[1].trim().slice(0, 80);
  }

  const catMatch = text.match(
    /\b(?:category|type|we (?:are|do|sell)|we'?re a)\s+([A-Za-z][A-Za-z\s&-]{1,40})/i
  );
  if (catMatch?.[1]) draft.category = catMatch[1].trim().slice(0, 60);

  if (text.length > 40 && !draft.summary) {
    draft.summary = text.slice(0, 600);
  }

  return draft;
}

export async function upsertBusinessFromDraft(input: {
  userId: string;
  draft: BusinessDraft;
  fallbackEmail?: string | null;
}) {
  const existing = await prisma.business.findFirst({
    where: { ownerUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  const name =
    input.draft.name?.trim() ||
    existing?.name ||
    "My Business";
  const contactEmail =
    input.draft.contactEmail?.trim() ||
    existing?.contactEmail ||
    input.fallbackEmail ||
    null;

  const data = {
    name,
    summary: input.draft.summary?.trim() || existing?.summary || null,
    category: input.draft.category?.trim() || existing?.category || null,
    location: input.draft.location?.trim() || existing?.location || null,
    contactEmail,
    contactPhone:
      input.draft.contactPhone?.trim() || existing?.contactPhone || null,
  };

  if (existing) {
    const slug =
      existing.name === name
        ? existing.slug
        : await allocateBusinessSlug(name, existing.id);
    return prisma.business.update({
      where: { id: existing.id },
      data: { ...data, slug },
    });
  }

  const slug = await allocateBusinessSlug(name);
  return prisma.business.create({
    data: {
      ownerUserId: input.userId,
      slug,
      ...data,
    },
  });
}

export type BusinessAgentTurnResult = {
  assistantReply: string;
  suggestions: Array<{ label: string; prompt: string }>;
  businessId?: string;
  publicPath?: string;
};

export async function runBusinessProfileTurn(input: {
  userId: string;
  message: string;
  userEmail?: string | null;
}): Promise<BusinessAgentTurnResult> {
  const existing = await prisma.business.findFirst({
    where: { ownerUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  if (
    /^(list my business|add my (business|shop)|create (a )?business profile)\b/i.test(
      input.message.trim()
    ) &&
    !existing
  ) {
    return {
      assistantReply:
        "I can list your business on the directory. Tell me the business name, what you do, where you're based, and a contact email (phone optional).",
      suggestions: [
        {
          label: "Example listing",
          prompt:
            "My business is called Bright Print Co. We do local printing and branding in Pune. Contact email hello@brightprint.example",
        },
      ],
    };
  }

  const draft = extractBusinessDraft(input.message);
  if (!draft.name && !existing) {
    return {
      assistantReply:
        "What's the business name? You can also include category, location, and contact email.",
      suggestions: [],
    };
  }

  const business = await upsertBusinessFromDraft({
    userId: input.userId,
    draft,
    fallbackEmail: input.userEmail,
  });

  const missing: string[] = [];
  if (!business.summary) missing.push("a short summary");
  if (!business.contactEmail) missing.push("a contact email");
  if (!business.location) missing.push("a location");

  const publicPath = `/b/${business.slug}`;
  if (missing.length > 0) {
    return {
      assistantReply: `Saved **${business.name}** to the directory (${publicPath}). Still useful to add: ${missing.join(", ")}. Reply with those details anytime.`,
      suggestions: [
        {
          label: "Add contact email",
          prompt: `Contact email for ${business.name} is ${input.userEmail || "me@example.com"}`,
        },
        {
          label: "Post a gig",
          prompt: "I need someone for a logo design gig",
        },
      ],
      businessId: business.id,
      publicPath,
    };
  }

  return {
    assistantReply: `Your business **${business.name}** is live at ${publicPath}. Owner-chosen contact is shown on that page (shopfront model). You can post a gig anytime — e.g. “I need a logo designed.”`,
    suggestions: [
      {
        label: "View listing",
        prompt: `Show my business listing link again`,
      },
      {
        label: "Post a gig",
        prompt: "I need someone for a day of deliveries",
      },
    ],
    businessId: business.id,
    publicPath,
  };
}
