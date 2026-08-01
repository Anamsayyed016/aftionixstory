import "server-only";

import { prisma } from "@/lib/db";
import { saveBusinessProfile } from "@/lib/marketplace/mutations";
import { businessProfileSchema } from "@/lib/marketplace/schemas";
import {
  draftHasAnyField,
  extractBusinessDraft,
  formatCaptured,
  mergeBusinessDrafts,
  missingBusinessFields,
  readBusinessDraftFromState,
  type BusinessDraft,
} from "@/lib/business-agent/extract";

export type { BusinessDraft } from "@/lib/business-agent/extract";
export {
  extractBusinessDraft,
  mergeBusinessDrafts,
  readBusinessDraftFromState,
  withBusinessDraftInState,
} from "@/lib/business-agent/extract";

export async function upsertBusinessFromDraft(input: {
  userId: string;
  draft: BusinessDraft;
  fallbackEmail?: string | null;
}) {
  if (!input.draft.name?.trim()) {
    throw new Error("Business name is required to save");
  }

  const parsed = businessProfileSchema.safeParse({
    name: input.draft.name,
    category: input.draft.category,
    location: input.draft.location,
    contactEmail: input.draft.contactEmail || "",
    contactPhone: input.draft.contactPhone,
    summary: input.draft.summary,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Invalid business data");
  }

  return saveBusinessProfile({
    userId: input.userId,
    data: parsed.data,
    fallbackEmail: input.fallbackEmail,
  });
}

function draftFromBusiness(row: {
  name: string;
  summary: string | null;
  category: string | null;
  location: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}): BusinessDraft {
  return {
    name: row.name,
    summary: row.summary || undefined,
    category: row.category || undefined,
    location: row.location || undefined,
    contactEmail: row.contactEmail || undefined,
    contactPhone: row.contactPhone || undefined,
  };
}

export type BusinessAgentTurnResult = {
  assistantReply: string;
  suggestions: Array<{ label: string; prompt: string }>;
  businessId?: string;
  publicPath?: string;
  /** Accumulated draft to persist on Conversation.state */
  nextDraft: BusinessDraft;
};

export async function runBusinessProfileTurn(input: {
  userId: string;
  message: string;
  userEmail?: string | null;
  /** Conversation.state JSON — carries marketplace.businessDraft across turns */
  conversationState?: unknown;
}): Promise<BusinessAgentTurnResult> {
  const existing = await prisma.business.findFirst({
    where: { ownerUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  const priorDraft = mergeBusinessDrafts(
    existing ? draftFromBusiness(existing) : {},
    readBusinessDraftFromState(input.conversationState)
  );

  const starter =
    /^(list my business|add my (business|shop)|create (a )?business profile|help me (list|add) (my )?business)\b/i.test(
      input.message.trim()
    );

  if (starter && !draftHasAnyField(priorDraft) && !existing) {
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
      nextDraft: priorDraft,
    };
  }

  const extracted = extractBusinessDraft(input.message);
  const merged = mergeBusinessDrafts(priorDraft, extracted);

  // Safeguard: user answered but we extracted nothing new
  if (
    !starter &&
    !draftHasAnyField(extracted) &&
    input.message.trim().length > 0
  ) {
    const captured = formatCaptured(merged);
    const need = missingBusinessFields(merged);
    return {
      assistantReply: captured
        ? `I couldn't quite parse that last message. Still have: ${captured}. Can you give me just the ${need[0] || "business name"}? (e.g. "name - Hoor" or "location - Banswara")`
        : `I couldn't quite parse that — can you give me just the business name? (e.g. "name - Hoor")`,
      suggestions: [
        {
          label: "Send name only",
          prompt: "name - ",
        },
      ],
      nextDraft: merged,
    };
  }

  // Need name before we persist to DB
  if (!merged.name?.trim()) {
    const captured = formatCaptured(merged);
    return {
      assistantReply: captured
        ? `Got it so far (${captured}). What's the business name?`
        : `What's the business name? You can also include category, location, and contact email.`,
      suggestions: [],
      nextDraft: merged,
    };
  }

  // Fill summary from category if still empty
  if (!merged.summary && merged.category) {
    merged.summary = `${merged.name} — ${merged.category}${
      merged.location ? ` in ${merged.location}` : ""
    }.`;
  }

  const business = await upsertBusinessFromDraft({
    userId: input.userId,
    draft: merged,
    fallbackEmail: input.userEmail,
  });

  const savedDraft = draftFromBusiness(business);
  const publicPath = `/b/${business.slug}`;
  const captured = formatCaptured(savedDraft);
  const stillNeed = missingBusinessFields(savedDraft).filter(
    (f) => f !== "business name"
  );
  const isPublic = business.verifiedAt != null;

  if (stillNeed.length > 0) {
    return {
      assistantReply: `Saved **${business.name}** (${captured}). Still need: ${stillNeed.join(", ")}. Reply with just those — e.g. "location - Banswara".`,
      suggestions: [
        {
          label: "Add location",
          prompt: "location - ",
        },
        {
          label: "Add email",
          prompt: `email - ${input.userEmail || "me@example.com"}`,
        },
      ],
      businessId: business.id,
      publicPath: isPublic ? publicPath : undefined,
      nextDraft: savedDraft,
    };
  }

  if (!isPublic) {
    const accountEmail = input.userEmail || "your account email";
    return {
      assistantReply: `Saved **${business.name}**, but it isn’t public yet. To verify and publish ${publicPath}, set the contact email to your account email (**${accountEmail}**) — e.g. “email - ${accountEmail}”.`,
      suggestions: [
        {
          label: "Verify with my email",
          prompt: `email - ${accountEmail}`,
        },
      ],
      businessId: business.id,
      nextDraft: savedDraft,
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
    nextDraft: savedDraft,
  };
}
