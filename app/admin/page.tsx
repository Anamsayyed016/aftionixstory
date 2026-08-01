import Link from "next/link";

import { getAdminOverviewStats } from "@/lib/admin/queries";
import { GlassCard } from "@/components/ui/glass-card";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const stats = await getAdminOverviewStats();

  const cards = [
    { label: "Users", value: stats.users, href: "/admin/users" },
    {
      label: "Businesses",
      value: stats.businesses,
      sub: `${stats.verifiedBusinesses} verified · ${stats.pendingBusinesses} pending`,
      href: "/admin/businesses",
    },
    { label: "Freelancer profiles", value: stats.freelancers },
    {
      label: "Gigs posted",
      value: stats.gigs,
      sub: `${stats.openGigs} open`,
    },
    {
      label: "Matches",
      value: stats.matches,
      sub: `${stats.acceptedMatches} accepted`,
    },
    {
      label: "Generations",
      value: stats.generations,
      sub: `${stats.generationFailures} failed`,
      href: "/admin/generations",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Overview
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Platform counts for Directory, Connect, and Studio usage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <GlassCard className="h-full p-5">
              <p className="text-xs uppercase tracking-wider text-ink-faint">
                {card.label}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                {card.value}
              </p>
              {"sub" in card && card.sub ? (
                <p className="mt-1 text-xs text-ink-dim">{card.sub}</p>
              ) : null}
            </GlassCard>
          );
          if ("href" in card && card.href) {
            return (
              <Link
                key={card.label}
                href={card.href}
                className="block transition-opacity hover:opacity-90"
              >
                {inner}
              </Link>
            );
          }
          return <div key={card.label}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
