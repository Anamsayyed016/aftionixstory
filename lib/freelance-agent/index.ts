import "server-only";

import type { GigMatchInitiator, GigMatchStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  createGigRequest,
  saveFreelancerProfile,
} from "@/lib/marketplace/mutations";
import { freelancerProfileSchema, gigPostingSchema } from "@/lib/marketplace/schemas";
import {
  canRevealMatchContact,
  revealContactsForMatch,
} from "@/lib/freelance-agent/contact-reveal";
import {
  rankFreelancersForGig,
  rankGigsForFreelancer,
} from "@/lib/freelance-agent/matching";

export type FreelancerDraft = {
  summary?: string;
  skills?: string[];
  location?: string;
  availability?: string;
  portfolioLinks?: string[];
  contactEmail?: string;
  contactPhone?: string;
  displayNameHint?: string;
};

export function extractFreelancerDraft(message: string): FreelancerDraft {
  const text = message.trim();
  const draft: FreelancerDraft = {};

  const skillsMatch = text.match(
    /\b(?:skills?|I (?:do|can)|I'm a|I am a)\s*:?\s*([^.!\n]+)/i
  );
  if (skillsMatch?.[1]) {
    draft.skills = skillsMatch[1]
      .split(/,|\/|&| and /i)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  const availMatch = text.match(
    /\b(?:available|availability)\s*:?\s*([^.!\n]+)/i
  );
  if (availMatch?.[1]) draft.availability = availMatch[1].trim().slice(0, 200);

  const locMatch = text.match(
    /\b(?:based in|located in|in)\s+([A-Za-z][A-Za-z\s-]{1,40})(?:\.|,|$)/i
  );
  if (locMatch?.[1] && !/need|looking/i.test(locMatch[1])) {
    draft.location = locMatch[1].trim();
  }
  if (/\bremote\b/i.test(text)) draft.location = draft.location || "remote";

  const links = [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((m) => m[0]);
  if (links.length) draft.portfolioLinks = links.slice(0, 8);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) draft.contactEmail = emailMatch[0];

  if (text.length > 30) draft.summary = text.slice(0, 800);

  if (/\b(?:designer|developer|writer|photographer|driver|editor)\b/i.test(text)) {
    const role = text.match(
      /\b(designer|developer|writer|photographer|driver|editor)\b/i
    );
    if (role) draft.displayNameHint = role[1];
  }

  return draft;
}

export type GigDraft = {
  title?: string;
  description?: string;
  skillNeeded?: string;
  category?: string;
  location?: string;
  budget?: string;
};

export function extractGigDraft(message: string): GigDraft {
  const text = message.trim();
  const draft: GigDraft = {
    description: text.slice(0, 2000),
  };

  if (/\blogo\b/i.test(text)) {
    draft.title = "Logo design";
    draft.skillNeeded = "logo design";
    draft.category = "design";
  } else if (/\bdeliver(?:y|ies)?\b/i.test(text)) {
    draft.title = "Delivery help";
    draft.skillNeeded = "delivery";
    draft.category = "logistics";
  } else if (/\b(website|web app|landing page)\b/i.test(text)) {
    draft.title = "Website work";
    draft.skillNeeded = "web development";
    draft.category = "development";
  } else {
    const needMatch = text.match(
      /\b(?:need|looking for|hire)\s+(?:a |an |someone (?:for |to )?)?([^.!\n]{3,60})/i
    );
    if (needMatch?.[1]) {
      draft.title = needMatch[1].trim().slice(0, 80);
      draft.skillNeeded = needMatch[1].trim().slice(0, 80);
    } else {
      draft.title = text.slice(0, 60);
    }
  }

  const budgetMatch = text.match(
    /\b(?:budget|pay|paying|rate)\s*:?\s*([^.!\n]{2,40})/i
  );
  if (budgetMatch?.[1]) draft.budget = budgetMatch[1].trim();

  if (/\bremote\b/i.test(text)) draft.location = "remote";
  const locMatch = text.match(/\bin\s+([A-Za-z][A-Za-z\s-]{1,40})(?:\.|,|$)/i);
  if (locMatch?.[1] && !draft.location) draft.location = locMatch[1].trim();

  return draft;
}

export async function upsertFreelancerFromDraft(input: {
  userId: string;
  draft: FreelancerDraft;
  nameHint?: string | null;
}) {
  const existing = await prisma.freelancerProfile.findUnique({
    where: { userId: input.userId },
  });

  const skills =
    input.draft.skills && input.draft.skills.length > 0
      ? input.draft.skills
      : existing?.skills || [];
  const summary =
    input.draft.summary?.trim() ||
    existing?.summary ||
    (skills.length > 0 ? `Skills: ${skills.join(", ")}` : "");

  const parsed = freelancerProfileSchema.safeParse({
    summary: summary || "Freelancer",
    skills: skills.length > 0 ? skills : ["general"],
    location: input.draft.location || existing?.location || undefined,
    availability:
      input.draft.availability || existing?.availability || undefined,
    portfolioLinks:
      input.draft.portfolioLinks && input.draft.portfolioLinks.length > 0
        ? input.draft.portfolioLinks
        : existing?.portfolioLinks || [],
    contactEmail:
      input.draft.contactEmail || existing?.contactEmail || undefined,
    contactPhone:
      input.draft.contactPhone || existing?.contactPhone || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message || "Invalid freelancer profile"
    );
  }

  return saveFreelancerProfile({
    userId: input.userId,
    data: parsed.data,
    nameHint:
      input.draft.displayNameHint || input.nameHint || skills[0] || null,
  });
}

export type MarketplaceSuggestion = { label: string; prompt: string };

export type FreelanceAgentTurnResult = {
  assistantReply: string;
  suggestions: MarketplaceSuggestion[];
};

async function handleMatchCommand(input: {
  userId: string;
  message: string;
}): Promise<FreelanceAgentTurnResult | null> {
  const express = input.message.match(
    /\bexpress interest\b.+\b(?:gig|freelancer)\s+([a-z0-9_-]+)/i
  );
  const accept = input.message.match(/\baccept (?:match|connection)\s+([a-z0-9_-]+)/i);
  const decline = input.message.match(
    /\b(?:decline|withdraw) (?:match|connection)\s+([a-z0-9_-]+)/i
  );

  if (express) {
    const token = express[1]!;
    return expressInterestByToken({ userId: input.userId, token });
  }
  if (accept) {
    return respondToMatch({
      userId: input.userId,
      matchId: accept[1]!,
      next: "ACCEPTED",
    });
  }
  if (decline) {
    const isWithdraw = /\bwithdraw\b/i.test(input.message);
    return respondToMatch({
      userId: input.userId,
      matchId: decline[1]!,
      next: isWithdraw ? "WITHDRAWN" : "DECLINED",
    });
  }
  return null;
}

async function expressInterestByToken(input: {
  userId: string;
  token: string;
}): Promise<FreelanceAgentTurnResult> {
  const gig = await prisma.gigRequest.findFirst({
    where: {
      OR: [{ id: input.token }, { id: { startsWith: input.token } }],
      status: "OPEN",
    },
    include: { business: true },
  });
  const freelancer = await prisma.freelancerProfile.findFirst({
    where: {
      OR: [{ id: input.token }, { slug: input.token }],
    },
  });

  if (gig) {
    const myProfile = await prisma.freelancerProfile.findUnique({
      where: { userId: input.userId },
    });
    if (!myProfile) {
      return {
        assistantReply:
          "Create a freelancer profile first (skills + availability), then express interest in a gig.",
        suggestions: [
          {
            label: "Set up freelancer profile",
            prompt:
              "I'm a designer looking for gig work. Skills: logo design, branding. Based in remote. Available weekdays.",
          },
        ],
      };
    }
    return createOrGetMatch({
      userId: input.userId,
      gigId: gig.id,
      freelancerProfileId: myProfile.id,
      initiatedBy: "FREELANCER",
    });
  }

  if (freelancer) {
    const business = await prisma.business.findFirst({
      where: { ownerUserId: input.userId },
    });
    if (!business) {
      return {
        assistantReply:
          "List your business first, then you can express interest in freelancers for your gigs.",
        suggestions: [
          {
            label: "List my business",
            prompt: "List my business on the directory",
          },
        ],
      };
    }
    const openGig = await prisma.gigRequest.findFirst({
      where: { businessId: business.id, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
    if (!openGig) {
      return {
        assistantReply:
          "Post an open gig first, then express interest in a freelancer for that gig.",
        suggestions: [
          {
            label: "Post a gig",
            prompt: "I need a logo designed for my business",
          },
        ],
      };
    }
    return createOrGetMatch({
      userId: input.userId,
      gigId: openGig.id,
      freelancerProfileId: freelancer.id,
      initiatedBy: "BUSINESS",
    });
  }

  return {
    assistantReply:
      "I couldn't find that gig or freelancer. Open Connect to pick from your matches, or use a chip from suggestions.",
    suggestions: [],
  };
}

async function createOrGetMatch(input: {
  userId: string;
  gigId: string;
  freelancerProfileId: string;
  initiatedBy: GigMatchInitiator;
}): Promise<FreelanceAgentTurnResult> {
  const existing = await prisma.gigMatch.findUnique({
    where: {
      gigId_freelancerProfileId: {
        gigId: input.gigId,
        freelancerProfileId: input.freelancerProfileId,
      },
    },
  });
  if (existing) {
    if (existing.status === "ACCEPTED") {
      return formatAcceptedReveal(existing.id, input.userId);
    }
    return {
      assistantReply: `There's already a match (${existing.id}) in status **${existing.status}**. ${
        existing.status === "PENDING"
          ? `The other side can accept with: accept match ${existing.id}`
          : "You can post a new gig or update profiles to try again."
      }`,
      suggestions:
        existing.status === "PENDING"
          ? [
              {
                label: "Accept connection",
                prompt: `accept match ${existing.id}`,
              },
              {
                label: "Decline",
                prompt: `decline match ${existing.id}`,
              },
            ]
          : [],
    };
  }

  const match = await prisma.gigMatch.create({
    data: {
      gigId: input.gigId,
      freelancerProfileId: input.freelancerProfileId,
      initiatedBy: input.initiatedBy,
      initiatedByUserId: input.userId,
      status: "PENDING",
    },
  });

  return {
    assistantReply: `Interest recorded — match **${match.id}** is pending. Contact info stays hidden until the other side accepts. They can reply: accept match ${match.id}`,
    suggestions: [
      {
        label: "Open Connect",
        prompt: "Show my pending connections",
      },
    ],
  };
}

async function respondToMatch(input: {
  userId: string;
  matchId: string;
  next: Extract<GigMatchStatus, "ACCEPTED" | "DECLINED" | "WITHDRAWN">;
}): Promise<FreelanceAgentTurnResult> {
  const match = await prisma.gigMatch.findFirst({
    where: {
      OR: [{ id: input.matchId }, { id: { startsWith: input.matchId } }],
    },
    include: {
      gig: { include: { business: true } },
      freelancerProfile: { include: { user: { select: { email: true } } } },
    },
  });
  if (!match) {
    return {
      assistantReply: "I couldn't find that match id.",
      suggestions: [],
    };
  }

  const isBusinessOwner = match.gig.business.ownerUserId === input.userId;
  const isFreelancer = match.freelancerProfile.userId === input.userId;
  if (!isBusinessOwner && !isFreelancer) {
    return {
      assistantReply: "You're not a party to this match.",
      suggestions: [],
    };
  }

  // Initiator cannot "accept" their own pending interest — the other side accepts.
  if (input.next === "ACCEPTED") {
    if (match.initiatedByUserId === input.userId && match.status === "PENDING") {
      return {
        assistantReply:
          "You already expressed interest. Wait for the other side to accept, or withdraw the match.",
        suggestions: [
          {
            label: "Withdraw",
            prompt: `withdraw match ${match.id}`,
          },
        ],
      };
    }
  }

  const updated = await prisma.gigMatch.update({
    where: { id: match.id },
    data: { status: input.next },
  });

  if (input.next === "ACCEPTED") {
    await prisma.gigRequest.update({
      where: { id: match.gigId },
      data: { status: "MATCHED" },
    });
    return formatAcceptedReveal(updated.id, input.userId);
  }

  return {
    assistantReply: `Match ${updated.id} is now **${updated.status}**. Contact info was not shared.`,
    suggestions: [],
  };
}

async function formatAcceptedReveal(
  matchId: string,
  userId: string
): Promise<FreelanceAgentTurnResult> {
  const match = await prisma.gigMatch.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      gig: { include: { business: true } },
      freelancerProfile: { include: { user: { select: { email: true } } } },
    },
  });

  const revealed = revealContactsForMatch({
    status: match.status,
    business: match.gig.business,
    freelancer: {
      contactEmail: match.freelancerProfile.contactEmail,
      contactPhone: match.freelancerProfile.contactPhone,
      userEmail: match.freelancerProfile.user.email,
    },
  });

  if (!revealed.revealed || !canRevealMatchContact(match.status)) {
    return {
      assistantReply: "Match is not accepted — no contact to show.",
      suggestions: [],
    };
  }

  const isBusinessOwner = match.gig.business.ownerUserId === userId;
  const other = isBusinessOwner ? revealed.freelancer : revealed.business;
  const otherLabel = isBusinessOwner ? "Freelancer" : "Business";

  return {
    assistantReply: `Connected! Match **${match.id}** is accepted. ${otherLabel} contact — email: ${other.email || "not set"}${other.phone ? `, phone: ${other.phone}` : ""}. (No payments/escrow in v1 — arrange terms directly.)`,
    suggestions: [],
  };
}

export async function runGigPostingTurn(input: {
  userId: string;
  message: string;
}): Promise<FreelanceAgentTurnResult> {
  const cmd = await handleMatchCommand(input);
  if (cmd) return cmd;

  const business = await prisma.business.findFirst({
    where: { ownerUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });
  if (!business) {
    return {
      assistantReply:
        "To post a gig you need a Business Directory listing first. Tell me your business name and contact email to get started.",
      suggestions: [
        {
          label: "List my business",
          prompt: "List my business on the directory",
        },
      ],
    };
  }

  const draft = extractGigDraft(input.message);
  const parsed = gigPostingSchema.safeParse({
    title: draft.title || "New gig",
    description: draft.description || input.message,
    skillNeeded: draft.skillNeeded,
    category: draft.category,
    location: draft.location || business.location || undefined,
    budget: draft.budget,
  });
  if (!parsed.success) {
    return {
      assistantReply:
        parsed.error.issues[0]?.message ||
        "I couldn't save that gig — try again with a clearer title and description.",
      suggestions: [],
    };
  }

  const gig = await createGigRequest({
    userId: input.userId,
    data: parsed.data,
  });

  const freelancers = await prisma.freelancerProfile.findMany({
    take: 40,
    orderBy: { updatedAt: "desc" },
  });
  const ranked = rankFreelancersForGig(
    {
      id: gig.id,
      title: gig.title,
      description: gig.description,
      skillNeeded: gig.skillNeeded,
      category: gig.category,
      location: gig.location,
    },
    freelancers.map((f) => ({
      id: f.id,
      slug: f.slug,
      summary: f.summary,
      skills: f.skills,
      location: f.location,
      availability: f.availability,
    })),
    3
  );

  const lines = ranked.map(
    (f, i) =>
      `${i + 1}. /f/${f.slug} — ${(f.skills || []).slice(0, 3).join(", ") || "skills TBD"} (score ${f.score})`
  );

  return {
    assistantReply: [
      `Gig **${gig.title}** posted for ${business.name} (id ${gig.id}).`,
      ranked.length
        ? `Possible freelancers:\n${lines.join("\n")}\n\nExpress interest without sharing contact yet — e.g. express interest in freelancer ${ranked[0]!.slug}`
        : "No freelancer profiles matched yet. When people list skills, they'll show up here.",
      "Payment/escrow is not available in v1 — connect only.",
    ].join("\n\n"),
    suggestions: ranked.slice(0, 2).map((f) => ({
      label: `Interest: ${f.slug}`,
      prompt: `express interest in freelancer ${f.slug}`,
    })),
  };
}

export async function runFreelancerProfileTurn(input: {
  userId: string;
  message: string;
  userName?: string | null;
}): Promise<FreelanceAgentTurnResult> {
  const cmd = await handleMatchCommand(input);
  if (cmd) return cmd;

  if (/\bshow my pending connections\b/i.test(input.message)) {
    return listPendingForUser(input.userId);
  }

  const draft = extractFreelancerDraft(input.message);
  if (
    /^(find gig work|set up (my )?freelancer profile|i'?m (a |looking for gigs))/i.test(
      input.message.trim()
    ) &&
    !draft.skills?.length
  ) {
    return {
      assistantReply:
        "I can set up your freelancer profile. Share your skills, location (or remote), availability, and optional portfolio links. Contact stays private until a mutual match.",
      suggestions: [
        {
          label: "Example profile",
          prompt:
            "I'm a designer looking for gig work. Skills: logo design, branding, illustration. Based in remote. Available weekdays. https://portfolio.example",
        },
      ],
    };
  }

  const profile = await upsertFreelancerFromDraft({
    userId: input.userId,
    draft,
    nameHint: input.userName,
  });

  const openGigs = await prisma.gigRequest.findMany({
    where: { status: "OPEN" },
    take: 40,
    orderBy: { createdAt: "desc" },
  });
  const ranked = rankGigsForFreelancer(
    {
      id: profile.id,
      slug: profile.slug,
      summary: profile.summary,
      skills: profile.skills,
      location: profile.location,
      availability: profile.availability,
    },
    openGigs.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      skillNeeded: g.skillNeeded,
      category: g.category,
      location: g.location,
    })),
    3
  );

  return {
    assistantReply: [
      `Freelancer profile saved: /f/${profile.slug}`,
      `Public page shows summary, skills, location, availability, portfolio — not your contact.`,
      ranked.length
        ? `Open gigs you might like:\n${ranked
            .map(
              (g, i) =>
                `${i + 1}. ${g.title} (${g.id.slice(0, 8)}…) — express interest in gig ${g.id}`
            )
            .join("\n")}`
        : "No open gigs matched yet. Check back after businesses post tasks.",
    ].join("\n\n"),
    suggestions: ranked.slice(0, 2).map((g) => ({
      label: `Interest: ${g.title.slice(0, 24)}`,
      prompt: `express interest in gig ${g.id}`,
    })),
  };
}

async function listPendingForUser(
  userId: string
): Promise<FreelanceAgentTurnResult> {
  const matches = await prisma.gigMatch.findMany({
    where: {
      status: "PENDING",
      OR: [
        { initiatedByUserId: userId },
        { freelancerProfile: { userId } },
        { gig: { business: { ownerUserId: userId } } },
      ],
    },
    include: {
      gig: { include: { business: true } },
      freelancerProfile: true,
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  if (!matches.length) {
    return {
      assistantReply: "No pending connections right now.",
      suggestions: [],
    };
  }

  const lines = matches.map((m) => {
    const waitingOnYou =
      m.initiatedByUserId !== userId &&
      (m.freelancerProfile.userId === userId ||
        m.gig.business.ownerUserId === userId);
    return `• ${m.id} — ${m.gig.title} ↔ /f/${m.freelancerProfile.slug}${
      waitingOnYou ? " (waiting on you to accept)" : " (waiting on them)"
    }`;
  });

  const actionable = matches.find((m) => m.initiatedByUserId !== userId);

  return {
    assistantReply: `Pending matches:\n${lines.join("\n")}\n\nContact is hidden until accepted.`,
    suggestions: actionable
      ? [
          {
            label: "Accept",
            prompt: `accept match ${actionable.id}`,
          },
          {
            label: "Decline",
            prompt: `decline match ${actionable.id}`,
          },
        ]
      : [],
  };
}
