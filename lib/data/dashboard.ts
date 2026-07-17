import "server-only";

import type { Plan, Story, StoryStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  countUserStories,
  countUserStoriesByStatus,
} from "@/lib/data/stories";
import { countUserCharacters } from "@/lib/data/characters";
import { countActiveWritingRules } from "@/lib/data/writing-rules";
import { getEffectiveGenerationLimit } from "@/lib/plans";
import { resolveUsagePeriod } from "@/lib/usage/period";

export type DashboardRecentStory = Story & {
  _count: { characters: number };
};

export type DashboardStats = {
  totalStories: number;
  activeStories: number;
  draftStories: number;
  totalCharacters: number;
  activeWritingRules: number;
  monthlyGenerations: number;
  generationLimit: number;
  plan: Plan | "FREE";
  recentStories: DashboardRecentStory[];
};

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const [
    totalStories,
    activeStories,
    draftStories,
    totalCharacters,
    activeWritingRules,
    user,
    recentStories,
  ] = await Promise.all([
    countUserStories(userId),
    countUserStoriesByStatus(userId, "ACTIVE" satisfies StoryStatus),
    countUserStoriesByStatus(userId, "DRAFT" satisfies StoryStatus),
    countUserCharacters(userId),
    countActiveWritingRules(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        monthlyGenerationCount: true,
        generationLimit: true,
        generationPeriodStart: true,
      },
    }),
    prisma.story.findMany({
      where: { userId, status: { in: ["ACTIVE", "DRAFT"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        _count: { select: { characters: true } },
      },
    }),
  ]);

  const period = user
    ? resolveUsagePeriod(
        user.generationPeriodStart,
        user.monthlyGenerationCount
      )
    : null;

  return {
    totalStories,
    activeStories,
    draftStories,
    totalCharacters,
    activeWritingRules,
    monthlyGenerations: period?.monthlyGenerationCount ?? 0,
    generationLimit: getEffectiveGenerationLimit({
      plan: user?.plan ?? "FREE",
      generationLimit: user?.generationLimit,
    }),
    plan: user?.plan ?? "FREE",
    recentStories,
  };
}
