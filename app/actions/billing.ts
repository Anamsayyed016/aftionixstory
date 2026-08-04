"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { getPlanLimits } from "@/lib/plans";

export async function cancelSubscriptionAction() {
  const user = await requireUser();

  const active = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ["ACTIVE", "AUTHENTICATED", "PENDING", "CREATED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!active) {
    throw new Error("No active subscription to cancel");
  }

  const razorpay = getRazorpayClient();
  await razorpay.subscriptions.cancel(active.razorpaySubscriptionId, false);

  await prisma.subscription.update({
    where: { id: active.id },
    data: {
      status: "CANCELLED",
      cancelAtPeriodEnd: false,
    },
  });

  const free = getPlanLimits("FREE");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "FREE",
      generationLimit: free.generationLimit,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
