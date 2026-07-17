import { Settings } from "lucide-react";

import { auth } from "@/auth";
import { EmptyState } from "@/components/app/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
          Account
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Settings
        </h2>
        <p className="mt-2 text-sm text-ink-dim">
          Profile editing, exports, and account deletion ship in a later phase.
        </p>
      </div>

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
              <Badge variant="violet">{session?.user?.plan || "FREE"}</Badge>
            </dd>
          </div>
        </dl>
      </GlassCard>

      <EmptyState
        icon={Settings}
        title="More settings coming later"
        description="Default language, writing style, appearance preferences, data export, and account deletion are planned — not available in Phase A."
      />
    </div>
  );
}
