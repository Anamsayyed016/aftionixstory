import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { PAID_PLAN_INR, isPaidPlan, type PaidPlan } from "@/lib/billing/plans";
import { prisma } from "@/lib/db";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  isRazorpayConfigured,
  razorpayPlanIdFor,
} from "@/lib/razorpay/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  plan: z.enum(["WRITER", "STUDIO"]),
});

function razorpayErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Billing request failed";
  const e = err as {
    error?: { description?: string; code?: string; field?: string };
    message?: string;
  };
  const field = e.error?.field ? ` (${e.error.field})` : "";
  return (e.error?.description || e.message || "Billing request failed") + field;
}

function isValidationFailed(err: unknown): boolean {
  return razorpayErrorMessage(err).toLowerCase().includes("validation failed");
}

/**
 * Prefer Subscriptions API; if the merchant account rejects subscription
 * create (common when recurring is not enabled), fall back to a one-time
 * Order for the monthly amount. Webhook still grants access.
 */
export async function POST(req: Request) {
  try {
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
    const amountPaise = PAID_PLAN_INR[plan] * 100;
    const notes = { userId: user.id, plan };
    const keyId = getRazorpayKeyId();

    // --- Try true Razorpay Subscription (recurring) ---
    let razorpayPlanId = "";
    try {
      razorpayPlanId = razorpayPlanIdFor(plan);
      const subscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlanId,
        total_count: 120,
        quantity: 1,
        customer_notify: true as unknown as 0 | 1,
        notes,
      });

      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan,
          status: "CREATED",
          razorpaySubscriptionId: String(subscription.id),
          razorpayPlanId,
        },
      });

      return NextResponse.json({
        mode: "subscription",
        subscriptionId: subscription.id,
        keyId,
        plan,
      });
    } catch (subErr) {
      // Recurring not enabled / merchant rejection → Order checkout.
      if (!isValidationFailed(subErr)) {
        throw subErr;
      }
      console.error(
        "[billing.create-subscription] subscriptions.create failed; using order fallback:",
        razorpayErrorMessage(subErr)
      );
    }

    // --- Order fallback (one-time monthly charge) ---
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `plan_${plan}_${user.id.slice(0, 8)}_${Date.now()}`.slice(0, 40),
      notes,
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan,
        status: "CREATED",
        // Store order id in this column until Subscriptions API works.
        razorpaySubscriptionId: String(order.id),
        razorpayPlanId: razorpayPlanId || `order_${plan}`,
      },
    });

    return NextResponse.json({
      mode: "order",
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      keyId,
      plan,
      prefill: {
        email: user.email,
        name: user.name || undefined,
      },
    });
  } catch (err) {
    console.error(
      "[billing.create-subscription]",
      razorpayErrorMessage(err)
    );
    return NextResponse.json(
      { error: razorpayErrorMessage(err) },
      { status: 502 }
    );
  }
}
