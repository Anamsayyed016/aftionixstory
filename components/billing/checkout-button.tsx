"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { PaidPlan } from "@/lib/billing/plans";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Client only"));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export function CheckoutButton({
  plan,
  label,
  variant = "primary",
  className,
}: {
  plan: PaidPlan;
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as {
        error?: string;
        subscriptionId?: string;
        keyId?: string;
      };
      if (!res.ok || !data.subscriptionId || !data.keyId) {
        if (res.status === 401) {
          router.push(
            `/sign-in?callbackUrl=${encodeURIComponent("/studio#pricing")}`
          );
          return;
        }
        throw new Error(data.error || "Could not start checkout");
      }

      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay Checkout unavailable");

      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "AFTIONIX Studio",
        description: `${plan === "WRITER" ? "Writer" : "Studio"} plan`,
        theme: { color: "#0e7490" },
        handler: () => {
          // Access is granted by webhook — this only routes the user.
          router.push("/settings?billing=pending");
          router.refresh();
        },
      });

      rzp.on("payment.failed", () => {
        setError("Payment failed. You can try again.");
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        className="w-full"
        loading={loading}
        onClick={() => void startCheckout()}
      >
        {label}
      </Button>
      {error ? (
        <p className="mt-2 text-center text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}
