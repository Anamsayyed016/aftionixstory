import "server-only";

import { prisma } from "@/lib/db";

export async function getAdminOverviewStats() {
  const [
    users,
    businesses,
    verifiedBusinesses,
    freelancers,
    gigs,
    openGigs,
    matches,
    acceptedMatches,
    generations,
    generationFailures,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.business.count({ where: { verifiedAt: { not: null } } }),
    prisma.freelancerProfile.count(),
    prisma.gigRequest.count(),
    prisma.gigRequest.count({ where: { status: "OPEN" } }),
    prisma.gigMatch.count(),
    prisma.gigMatch.count({ where: { status: "ACCEPTED" } }),
    prisma.generationLog.count(),
    prisma.generationLog.count({ where: { success: false } }),
  ]);

  return {
    users,
    businesses,
    verifiedBusinesses,
    pendingBusinesses: businesses - verifiedBusinesses,
    freelancers,
    gigs,
    openGigs,
    matches,
    acceptedMatches,
    generations,
    generationFailures,
  };
}

export async function listAdminBusinesses(take = 100) {
  return prisma.business.findMany({
    orderBy: [{ verifiedAt: "asc" }, { createdAt: "desc" }],
    take,
    include: {
      owner: { select: { id: true, email: true, name: true } },
      _count: { select: { gigs: true } },
    },
  });
}

export async function listAdminUsers(take = 100) {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      createdAt: true,
      monthlyGenerationCount: true,
      generationLimit: true,
      _count: {
        select: {
          stories: true,
          businesses: true,
          generationLogs: true,
        },
      },
      freelancerProfile: { select: { id: true, slug: true } },
    },
  });
}

export async function getGenerationCostSummary() {
  const [total, byAction, recent] = await Promise.all([
    prisma.generationLog.aggregate({
      _count: { id: true },
      _sum: {
        estimatedInputTokens: true,
        estimatedOutputTokens: true,
        durationMs: true,
      },
    }),
    prisma.generationLog.groupBy({
      by: ["action"],
      _count: { id: true },
      _sum: {
        estimatedInputTokens: true,
        estimatedOutputTokens: true,
      },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.generationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        action: true,
        success: true,
        provider: true,
        model: true,
        estimatedInputTokens: true,
        estimatedOutputTokens: true,
        durationMs: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  const successCount = await prisma.generationLog.count({
    where: { success: true },
  });

  return {
    total: total._count.id,
    successCount,
    failureCount: total._count.id - successCount,
    estimatedInputTokens: total._sum.estimatedInputTokens ?? 0,
    estimatedOutputTokens: total._sum.estimatedOutputTokens ?? 0,
    totalDurationMs: total._sum.durationMs ?? 0,
    byAction,
    recent,
  };
}
