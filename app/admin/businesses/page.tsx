import Link from "next/link";

import { listAdminBusinesses } from "@/lib/admin/queries";
import { BusinessModerationActions } from "@/components/admin/business-moderation-actions";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";

export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage() {
  const businesses = await listAdminBusinesses();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Business moderation
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Verify, unverify, or remove listings. Verified listings appear on
          public /b pages.
        </p>
      </div>

      {businesses.length === 0 ? (
        <GlassCard className="p-6 text-sm text-ink-dim">
          No businesses yet.
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {businesses.map((b) => {
            const verified = Boolean(b.verifiedAt);
            return (
              <GlassCard
                key={b.id}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold">{b.name}</p>
                    <Badge variant={verified ? "success" : "violet"} dot>
                      {verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-dim">
                    {b.category || "—"} · {b.location || "—"} ·{" "}
                    {b._count.gigs} gig{b._count.gigs === 1 ? "" : "s"}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    Owner: {b.owner.email}
                    {b.owner.name ? ` (${b.owner.name})` : ""}
                  </p>
                  <p className="font-mono text-xs text-lilac">
                    <Link href={`/b/${b.slug}`} className="hover:underline">
                      /b/{b.slug}
                    </Link>
                  </p>
                </div>
                <BusinessModerationActions
                  businessId={b.id}
                  verified={verified}
                  name={b.name}
                />
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
