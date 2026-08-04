import { NextResponse } from "next/server";

import {
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay/client";
import {
  markSubscriptionPastDue,
  syncSubscriptionFromRazorpayEntity,
} from "@/lib/razorpay/sync";

export const runtime = "nodejs";

type WebhookPayload = {
  event?: string;
  payload?: {
    subscription?: { entity?: Record<string, unknown> };
    payment?: { entity?: Record<string, unknown> };
  };
};

/**
 * Razorpay webhook — signature required. Client-side checkout success is ignored for access.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event || "";
  const subscriptionEntity = payload.payload?.subscription?.entity as
    | {
        id: string;
        status?: string;
        plan_id?: string;
        customer_id?: string;
        current_end?: number | null;
        notes?: Record<string, string>;
      }
    | undefined;

  try {
    switch (event) {
      case "subscription.activated":
      case "subscription.charged":
      case "subscription.authenticated":
      case "subscription.pending":
      case "subscription.halted":
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.updated": {
        if (!subscriptionEntity?.id) {
          return NextResponse.json({ ok: true, skipped: "no subscription" });
        }
        await syncSubscriptionFromRazorpayEntity(subscriptionEntity);
        break;
      }
      case "payment.failed": {
        const notes = (payload.payload?.payment?.entity?.notes ||
          {}) as Record<string, string>;
        const subId =
          (payload.payload?.payment?.entity?.subscription_id as
            | string
            | undefined) || notes.subscription_id;
        if (typeof subId === "string" && subId) {
          await markSubscriptionPastDue(subId);
        }
        break;
      }
      default:
        // Acknowledge unknown events so Razorpay does not retry forever.
        break;
    }
  } catch (err) {
    // Do not include secrets; log only safe message.
    console.error(
      "[razorpay.webhook]",
      event,
      err instanceof Error ? err.message : "handler_error"
    );
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
