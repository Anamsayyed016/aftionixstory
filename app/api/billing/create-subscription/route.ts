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

type RazorpayCustomer = { id: string };

function razorpayErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Billing request failed";
  const e = err as {
    error?: { description?: string; code?: string };
    statusCode?: number;
    message?: string;
  };
  return (
    e.error?.description ||
    e.message ||
    "Billing request failed"
  );
}

function isCustomerExistsError(err: unknown): boolean {
  const msg = razorpayErrorMessage(err).toLowerCase();
  return msg.includes("customer already exists");
}

async function getOrCreateRazorpayCustomer(
  razorpay: ReturnType<typeof getRazorpayClient>,
  user: { id: string; email: string; name: string | null }
): Promise<RazorpayCustomer> {
  try {
    // Prefer returning an existing customer; SDK types accept 0|1.
    // If Razorpay still rejects as "already exists", fall through to lookup.
    const customer = await razorpay.customers.create({
      name: user.name || user.email.split("@")[0],
      email: user.email,
      fail_existing: 0,
      notes: { userId: user.id },
    });
    return { id: String(customer.id) };
  } catch (err) {
    if (!isCustomerExistsError(err)) throw err;

    // Reuse customer id from a prior Subscription row if we have one.
    const prior = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        razorpayCustomerId: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { razorpayCustomerId: true },
    });
    if (prior?.razorpayCustomerId) {
      return { id: prior.razorpayCustomerId };
    }

    // SDK pagination types omit email — Razorpay accepts it at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listed = (await (razorpay.customers.all as any)({
      email: user.email,
      count: 10,
    })) as { items?: Array<{ id: string; email?: string }> };

    const existing =
      listed.items?.find(
        (c) => (c.email || "").toLowerCase() === user.email.toLowerCase()
      ) || listed.items?.[0];

    if (!existing?.id) {
      throw new Error("Customer exists but could not be loaded");
    }
    return { id: String(existing.id) };
  }
}

/**
 * Creates a Razorpay subscription for the signed-in user.
 * Returns subscription_id + public key_id for Checkout — does NOT grant plan access.
 * Access is granted only via verified webhooks.
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
    const razorpayPlanId = razorpayPlanIdFor(plan);
    const customer = await getOrCreateRazorpayCustomer(razorpay, user);

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
        razorpayCustomerId: customer.id,
        razorpaySubscriptionId: String(subscription.id),
        razorpayPlanId,
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: getRazorpayKeyId(),
      plan,
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
