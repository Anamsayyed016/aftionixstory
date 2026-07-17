import "server-only";

import { prisma } from "@/lib/db";
import { getAiEnv } from "@/lib/env";
import { getEffectiveGenerationLimit } from "@/lib/plans";
import { resolveUsagePeriod } from "@/lib/usage/period";

export class UsageLimitError extends Error {
  code = "GENERATION_LIMIT_REACHED" as const;
  constructor(message = "Monthly generation limit reached.") {
    super(message);
    this.name = "UsageLimitError";
  }
}

export class RateLimitError extends Error {
  code = "AI_RATE_LIMITED" as const;
  constructor(message = "Too many generation requests. Please wait and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Ensure the user's monthly counter is for the current UTC month.
 * Returns the effective count after any reset.
 */
export async function ensureCurrentUsagePeriod(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      generationLimit: true,
      monthlyGenerationCount: true,
      generationPeriodStart: true,
    },
  });

  const resolved = resolveUsagePeriod(
    user.generationPeriodStart,
    user.monthlyGenerationCount
  );

  if (resolved.needsReset) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        monthlyGenerationCount: 0,
        generationPeriodStart: resolved.generationPeriodStart,
      },
      select: {
        id: true,
        plan: true,
        generationLimit: true,
        monthlyGenerationCount: true,
        generationPeriodStart: true,
      },
    });
    return updated;
  }

  return user;
}

export async function assertWithinGenerationLimit(userId: string) {
  const user = await ensureCurrentUsagePeriod(userId);
  const limit = getEffectiveGenerationLimit(user);
  if (user.monthlyGenerationCount >= limit) {
    throw new UsageLimitError();
  }
  return { user, limit };
}

/**
 * DB-backed lightweight rate limit using GenerationLog timestamps.
 * Documented limitation: accurate per-user across instances sharing the DB;
 * not a distributed token-bucket.
 */
export async function assertGenerationRateLimit(userId: string) {
  const env = getAiEnv();
  const since = new Date(Date.now() - env.AI_RATE_LIMIT_WINDOW_MS);
  const recent = await prisma.generationLog.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
  if (recent >= env.AI_RATE_LIMIT_MAX) {
    throw new RateLimitError();
  }
}

export async function incrementSuccessfulGeneration(userId: string) {
  await ensureCurrentUsagePeriod(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { monthlyGenerationCount: { increment: 1 } },
    select: {
      monthlyGenerationCount: true,
      generationLimit: true,
      plan: true,
      generationPeriodStart: true,
    },
  });
}

export async function getUsageSnapshot(userId: string) {
  const user = await ensureCurrentUsagePeriod(userId);
  const limit = getEffectiveGenerationLimit(user);
  return {
    used: user.monthlyGenerationCount,
    limit,
    periodStart: user.generationPeriodStart,
    plan: user.plan,
  };
}
