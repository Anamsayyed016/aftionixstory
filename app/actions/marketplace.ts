"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function assertPartyAndRespond(
  userId: string,
  matchId: string,
  next: "ACCEPTED" | "DECLINED" | "WITHDRAWN"
) {
  const match = await prisma.gigMatch.findUnique({
    where: { id: matchId },
    include: {
      gig: { include: { business: true } },
      freelancerProfile: true,
    },
  });
  if (!match) throw new Error("Match not found");

  const isBusinessOwner = match.gig.business.ownerUserId === userId;
  const isFreelancer = match.freelancerProfile.userId === userId;
  if (!isBusinessOwner && !isFreelancer) {
    throw new Error("Not a party to this match");
  }

  if (
    next === "ACCEPTED" &&
    match.status === "PENDING" &&
    match.initiatedByUserId === userId
  ) {
    throw new Error("Wait for the other side to accept");
  }

  await prisma.gigMatch.update({
    where: { id: matchId },
    data: { status: next },
  });

  if (next === "ACCEPTED") {
    await prisma.gigRequest.update({
      where: { id: match.gigId },
      data: { status: "MATCHED" },
    });
  }

  revalidatePath("/connect");
}

export async function acceptMatchAction(formData: FormData) {
  const user = await requireUser();
  const matchId = String(formData.get("matchId") || "");
  await assertPartyAndRespond(user.id, matchId, "ACCEPTED");
}

export async function declineMatchAction(formData: FormData) {
  const user = await requireUser();
  const matchId = String(formData.get("matchId") || "");
  await assertPartyAndRespond(user.id, matchId, "DECLINED");
}

export async function expressInterestInGigAction(formData: FormData) {
  const user = await requireUser();
  const gigId = String(formData.get("gigId") || "");
  const profile = await prisma.freelancerProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) throw new Error("Create a freelancer profile first");

  const gig = await prisma.gigRequest.findFirst({
    where: { id: gigId, status: "OPEN" },
  });
  if (!gig) throw new Error("Gig not found");

  await prisma.gigMatch.upsert({
    where: {
      gigId_freelancerProfileId: {
        gigId,
        freelancerProfileId: profile.id,
      },
    },
    create: {
      gigId,
      freelancerProfileId: profile.id,
      initiatedBy: "FREELANCER",
      initiatedByUserId: user.id,
      status: "PENDING",
    },
    update: {},
  });

  revalidatePath("/connect");
}

export async function expressInterestInFreelancerAction(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("freelancerSlug") || "");
  const business = await prisma.business.findFirst({
    where: { ownerUserId: user.id },
  });
  if (!business) throw new Error("List a business first");

  const openGig = await prisma.gigRequest.findFirst({
    where: { businessId: business.id, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (!openGig) throw new Error("Post a gig first");

  const freelancer = await prisma.freelancerProfile.findUnique({
    where: { slug },
  });
  if (!freelancer) throw new Error("Freelancer not found");

  await prisma.gigMatch.upsert({
    where: {
      gigId_freelancerProfileId: {
        gigId: openGig.id,
        freelancerProfileId: freelancer.id,
      },
    },
    create: {
      gigId: openGig.id,
      freelancerProfileId: freelancer.id,
      initiatedBy: "BUSINESS",
      initiatedByUserId: user.id,
      status: "PENDING",
    },
    update: {},
  });

  revalidatePath("/connect");
}
