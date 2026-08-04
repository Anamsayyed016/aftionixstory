import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  isPaidPlan,
  isRazorpayConfigured,
  razorpayPlanIdFor,
  type PaidPlan,
} from "@/lib/razorpay/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["WRITER", "STUDIO"]),
});

/**
 * Creates a Razorpay subscription for the signed-in user.
 * Returns subscription_id + public key_id for Checkout — does NOT grant plan access.
 * Access is granted only via verified webhooks.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = parsed.data.plan as PaidPlan;
  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  });

  const razorpay = getRazorpayClient();
  const razorpayPlanId = razorpayPlanIdFor(plan);

  const customer = await razorpay.customers.create({
    name: user.name || user.email.split("@")[0],
    email: user.email,
    fail_existing: 0,
    notes: { userId: user.id },
  });

  const subscription = await razorpay.subscriptions.create({
    plan_id: razorpayPlanId,
    // Razorpay requires finite total_count — 120 months ≈ ongoing.
    total_count: 120,
    quantity: 1,
    customer_notify: 1,
    notes: {
      userId: user.id,
      plan,
    },
  });

  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan,
      status: "CREATED",
      razorpayCustomerId: String(customer.id),
      razorpaySubscriptionId: String(subscription.id),
      razorpayPlanId,
    },
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: getRazorpayKeyId(),
    plan,
  });
}
