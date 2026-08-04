import "server-only";

import type { Plan, SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";
import { isPaidPlan } from "@/lib/billing/plans";

function mapRazorpayStatus(status: string | undefined): SubscriptionStatus {
  switch ((status || "").toLowerCase()) {
    case "authenticated":
      return "AUTHENTICATED";
    case "active":
      return "ACTIVE";
    case "pending":
      return "PENDING";
    case "halted":
      return "HALTED";
    case "cancelled":
      return "CANCELLED";
    case "completed":
      return "COMPLETED";
    case "created":
      return "CREATED";
    default:
      return "PAST_DUE";
  }
}

function planFromNotes(notes: Record<string, string> | undefined): Plan | null {
  const raw = notes?.plan?.toUpperCase();
  if (raw === "WRITER" || raw === "STUDIO") return raw;
  return null;
}

/**
 * Apply webhook subscription entity → DB Subscription + denormalized User.plan.
 * Webhook is the source of truth for granting/revoking paid access.
 */
export async function syncSubscriptionFromRazorpayEntity(entity: {
  id: string;
  status?: string;
  plan_id?: string;
  customer_id?: string;
  current_end?: number | null;
  notes?: Record<string, string>;
  ended_at?: number | null;
}) {
  const userId = entity.notes?.userId;
  if (!userId) {
    throw new Error("Subscription notes missing userId");
  }

  const plan =
    planFromNotes(entity.notes) ??
    (await prisma.subscription
      .findUnique({
        where: { razorpaySubscriptionId: entity.id },
        select: { plan: true },
      })
      .then((s) => s?.plan ?? null));

  if (!plan || !isPaidPlan(plan)) {
    throw new Error("Cannot resolve paid plan for subscription");
  }

  const status = mapRazorpayStatus(entity.status);
  const currentPeriodEnd = entity.current_end
    ? new Date(entity.current_end * 1000)
    : null;

  const subscription = await prisma.subscription.upsert({
    where: { razorpaySubscriptionId: entity.id },
    create: {
      userId,
      plan,
      status,
      razorpayCustomerId: entity.customer_id || null,
      razorpaySubscriptionId: entity.id,
      razorpayPlanId: entity.plan_id || "",
      currentPeriodEnd,
    },
    update: {
      status,
      razorpayCustomerId: entity.customer_id || undefined,
      razorpayPlanId: entity.plan_id || undefined,
      currentPeriodEnd,
    },
  });

  const entitlementsActive =
    status === "ACTIVE" || status === "AUTHENTICATED" || status === "PENDING";

  if (entitlementsActive) {
    const limits = getPlanLimits(plan);
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        generationLimit: limits.generationLimit,
      },
    });
  } else if (
    status === "CANCELLED" ||
    status === "COMPLETED" ||
    status === "HALTED"
  ) {
    // Only downgrade if this was the user's latest paid subscription.
    const otherActive = await prisma.subscription.findFirst({
      where: {
        userId,
        id: { not: subscription.id },
        status: { in: ["ACTIVE", "AUTHENTICATED", "PENDING"] },
      },
    });
    if (!otherActive) {
      const freeLimits = getPlanLimits("FREE");
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: "FREE",
          generationLimit: freeLimits.generationLimit,
        },
      });
    }
  }

  return subscription;
}

export async function markSubscriptionPastDue(razorpaySubscriptionId: string) {
  const existing = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId },
  });
  if (!existing) return null;

  return prisma.subscription.update({
    where: { razorpaySubscriptionId },
    data: { status: "PAST_DUE" },
  });
}
