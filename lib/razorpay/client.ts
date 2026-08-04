import "server-only";

import crypto from "crypto";
import Razorpay from "razorpay";

import type { Plan } from "@prisma/client";

import { isPaidPlan, type PaidPlan } from "@/lib/billing/plans";

export type { PaidPlan };
export { isPaidPlan };

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

/** Server-only Razorpay client. Never import from client components. */
export function getRazorpayClient() {
  const key_id = requireEnv("RAZORPAY_KEY_ID");
  const key_secret = requireEnv("RAZORPAY_KEY_SECRET");
  return new Razorpay({ key_id, key_secret });
}

export function getRazorpayKeyId(): string {
  return requireEnv("RAZORPAY_KEY_ID");
}

export function isRazorpayTestMode(): boolean {
  const id = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  return id.startsWith("rzp_test_");
}

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim()
  );
}

export function hasRazorpayPlanIds(): boolean {
  return Boolean(
    process.env.RAZORPAY_PLAN_WRITER_ID?.trim() &&
      process.env.RAZORPAY_PLAN_STUDIO_ID?.trim()
  );
}

export function razorpayPlanIdFor(plan: Exclude<Plan, "FREE">): string {
  if (plan === "WRITER") return requireEnv("RAZORPAY_PLAN_WRITER_ID");
  return requireEnv("RAZORPAY_PLAN_STUDIO_ID");
}

/**
 * Verify Razorpay webhook signature (HMAC SHA256 of raw body).
 * Never log the webhook secret.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? ""
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
