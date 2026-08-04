import { Settings } from "lucide-react";

import { auth } from "@/auth";
import { EmptyState } from "@/components/app/empty-state";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { isRazorpayConfigured, isRazorpayTestMode } from "@/lib/razorpay/client";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  const subscription = session?.user?.id
    ? await prisma.subscription.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          plan: true,
          status: true,
          currentPeriodEnd: true,
          razorpaySubscriptionId: true,
        },
      })
    : null;

  const dbUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      })
    : null;

  const plan = dbUser?.plan || session?.user?.plan || "FREE";
  const billingConfigured = isRazorpayConfigured();

  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-y-auto pb-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
          Account
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Settings
        </h2>
        <p className="mt-2 text-sm text-ink-dim">
          Profile and billing. Plan changes apply after Razorpay confirms
          payment (webhook) — not only after Checkout closes.
        </p>
      </div>

      {params.billing === "pending" ? (
        <GlassCard className="border-violet/30 bg-violet/5 p-4 text-sm text-ink-dim">
          Payment submitted. Your plan updates when Razorpay confirms (usually
          within a minute). Refresh this page if it still shows Free.
        </GlassCard>
      ) : null}

      <GlassCard className="space-y-4 p-6">
        <h3 className="font-display text-lg font-semibold text-ink">Profile</h3>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <dt className="text-ink-faint">Name</dt>
            <dd className="text-ink">{session?.user?.name || "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <dt className="text-ink-faint">Email</dt>
            <dd className="font-mono text-ink">{session?.user?.email || "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-faint">Plan</dt>
            <dd>
              <Badge variant="violet">{plan}</Badge>
            </dd>
          </div>
        </dl>
      </GlassCard>

      <GlassCard className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-ink">
            Subscription
          </h3>
          {billingConfigured && isRazorpayTestMode() ? (
            <Badge variant="warning">Razorpay test mode</Badge>
          ) : null}
        </div>
        {!billingConfigured ? (
          <p className="text-sm text-ink-dim">
            Billing isn’t configured on this environment yet. Add Razorpay test
            keys and plan IDs to enable Checkout.
          </p>
        ) : (
          <SubscriptionPanel plan={plan} subscription={subscription} />
        )}
      </GlassCard>

      <EmptyState
        icon={Settings}
        title="More settings coming later"
        description="Default language, writing style, appearance preferences, data export, and account deletion are planned."
      />
    </div>
  );
}
