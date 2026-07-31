import "server-only";

import { prisma } from "@/lib/db";
import {
  allocateBusinessSlug,
  allocateFreelancerSlug,
} from "@/lib/marketplace/slugs";
import type {
  BusinessProfileInput,
  FreelancerProfileInput,
  GigPostingInput,
} from "@/lib/marketplace/schemas";

/**
 * Shared write path for Business — used by chat agent and form actions.
 */
export async function saveBusinessProfile(input: {
  userId: string;
  data: BusinessProfileInput;
  fallbackEmail?: string | null;
}) {
  const existing = await prisma.business.findFirst({
    where: { ownerUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  const name = input.data.name.trim();
  const contactEmail =
    input.data.contactEmail?.trim() ||
    existing?.contactEmail ||
    input.fallbackEmail ||
    null;

  const payload = {
    name,
    summary: input.data.summary?.trim() || null,
    category: input.data.category?.trim() || null,
    location: input.data.location?.trim() || null,
    contactEmail,
    contactPhone: input.data.contactPhone?.trim() || null,
  };

  if (existing) {
    const slug =
      existing.name === name
        ? existing.slug
        : await allocateBusinessSlug(name, existing.id);
    return prisma.business.update({
      where: { id: existing.id },
      data: { ...payload, slug },
    });
  }

  const slug = await allocateBusinessSlug(name);
  return prisma.business.create({
    data: {
      ownerUserId: input.userId,
      slug,
      ...payload,
    },
  });
}

/**
 * Shared write path for FreelancerProfile — chat + form.
 */
export async function saveFreelancerProfile(input: {
  userId: string;
  data: FreelancerProfileInput;
  nameHint?: string | null;
}) {
  const existing = await prisma.freelancerProfile.findUnique({
    where: { userId: input.userId },
  });

  const payload = {
    summary: input.data.summary.trim(),
    skills: input.data.skills,
    location: input.data.location?.trim() || null,
    availability: input.data.availability?.trim() || null,
    portfolioLinks: input.data.portfolioLinks || [],
    contactEmail: input.data.contactEmail?.trim() || null,
    contactPhone: input.data.contactPhone?.trim() || null,
  };

  if (existing) {
    return prisma.freelancerProfile.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  const slugHint =
    input.nameHint || input.data.skills[0] || "freelancer";
  const slug = await allocateFreelancerSlug(slugHint);
  return prisma.freelancerProfile.create({
    data: {
      userId: input.userId,
      slug,
      ...payload,
    },
  });
}

/**
 * Shared write path for GigRequest — chat + form.
 * Requires an owned Business.
 */
export async function createGigRequest(input: {
  userId: string;
  data: GigPostingInput;
}) {
  const business = await prisma.business.findFirst({
    where: { ownerUserId: input.userId },
    orderBy: { createdAt: "asc" },
  });
  if (!business) {
    throw new Error(
      "List a business first before posting a gig."
    );
  }

  return prisma.gigRequest.create({
    data: {
      businessId: business.id,
      postedByUserId: input.userId,
      title: input.data.title.trim(),
      description: input.data.description.trim(),
      skillNeeded: input.data.skillNeeded?.trim() || null,
      category: input.data.category?.trim() || null,
      location:
        input.data.location?.trim() || business.location || null,
      budget: input.data.budget?.trim() || null,
      status: "OPEN",
    },
  });
}
