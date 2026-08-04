import { describe, expect, it } from "vitest";
import crypto from "crypto";

import { verifyRazorpayWebhookSignature } from "@/lib/razorpay/client";
import { getEffectiveGenerationLimit, getPlanLimits } from "@/lib/plans";
import { isPaidPlan } from "@/lib/billing/plans";

describe("Razorpay webhook signature", () => {
  const secret = "whsec_test_secret_for_unit_tests";
  const body = JSON.stringify({
    event: "subscription.activated",
    payload: { subscription: { entity: { id: "sub_test" } } },
  });

  it("accepts a valid HMAC signature", () => {
    const signature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    expect(verifyRazorpayWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      verifyRazorpayWebhookSignature(body, "deadbeef".repeat(8), secret)
    ).toBe(false);
  });

  it("rejects missing signature or secret", () => {
    expect(verifyRazorpayWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, "abc", "")).toBe(false);
  });
});

describe("plan gating", () => {
  it("maps paid plans to higher generation limits", () => {
    expect(getPlanLimits("FREE").generationLimit).toBe(20);
    expect(getPlanLimits("WRITER").generationLimit).toBe(300);
    expect(getPlanLimits("STUDIO").generationLimit).toBe(1000);
    expect(getEffectiveGenerationLimit({ plan: "WRITER" })).toBe(300);
  });

  it("recognizes paid plan keys", () => {
    expect(isPaidPlan("WRITER")).toBe(true);
    expect(isPaidPlan("FREE")).toBe(false);
  });
});
