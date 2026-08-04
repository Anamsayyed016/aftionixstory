"use client";

import { useTransition } from "react";

import { cancelSubscriptionAction } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SubscriptionPanel({
  plan,
  subscription,
}: {
  plan: string;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: Date | string | null;
    razorpaySubscriptionId: string;
  } | null;
}) {
  const [pending, start] = useTransition();

  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const canCancel =
    subscription &&
    ["ACTIVE", "AUTHENTICATED", "PENDING", "CREATED"].includes(
      subscription.status
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-faint">Current plan</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="violet">{plan}</Badge>
            {subscription ? (
              <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                {subscription.status}
              </span>
            ) : null}
          </div>
        </div>
        {periodEnd ? (
          <p className="text-sm text-ink-dim">
            Renews / period end:{" "}
            <span className="font-medium text-ink">{periodEnd}</span>
          </p>
        ) : null}
      </div>

      {canCancel ? (
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Cancel your subscription? You’ll return to the Free plan after cancellation."
              )
            ) {
              return;
            }
            start(async () => {
              await cancelSubscriptionAction();
            });
          }}
        >
          Cancel subscription
        </Button>
      ) : (
        <p className="text-sm text-ink-dim">
          Upgrade from{" "}
          <a href="/studio#pricing" className="text-lilac hover:underline">
            Pricing
          </a>
          .
        </p>
      )}
    </div>
  );
}
