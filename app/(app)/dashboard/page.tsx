import Link from "next/link";
import { Library, PenLine, Sparkles, UserRound } from "lucide-react";

import { auth } from "@/auth";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] || "Writer";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
          Workspace
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Welcome, {firstName}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-dim">
          Your account is ready. Story creation, AI episodes, and memory arrive
          in the next product phases — this shell is the foundation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Stories
          </p>
          <p className="mt-2 font-display text-3xl text-ink">0</p>
          <p className="mt-1 text-xs text-ink-dim">Available after Phase B</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Generations
          </p>
          <p className="mt-2 font-display text-3xl text-ink">
            0
            <span className="text-base text-ink-faint">
              /{session?.user?.plan === "FREE" ? "20" : "—"}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-dim">Counted when AI ships</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Plan
          </p>
          <div className="mt-2">
            <Badge variant="violet">{session?.user?.plan || "FREE"}</Badge>
          </div>
          <p className="mt-3 text-xs text-ink-dim">Billing not enabled yet</p>
        </GlassCard>
      </div>

      <EmptyState
        icon={PenLine}
        title="No stories yet"
        description="Story creation, characters, and episode generation are not available in Phase A. Your dashboard will fill with real data once those features ship."
        actionHref="/stories"
        actionLabel="Open My Stories"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 text-lilac">
            <Library className="h-4 w-4" />
            <h3 className="font-display text-lg font-semibold text-ink">
              Coming next
            </h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-dim">
            <li>• Multi-step story creation wizard</li>
            <li>• Character & relationship management</li>
            <li>• Episode workspace with AI generation</li>
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 text-rose">
            <Sparkles className="h-4 w-4" />
            <h3 className="font-display text-lg font-semibold text-ink">
              Account
            </h3>
          </div>
          <p className="mt-3 text-sm text-ink-dim">
            Profile defaults and export tools will live in Settings.
          </p>
          <Link href="/settings" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              <UserRound className="h-4 w-4" />
              Open settings
            </Button>
          </Link>
        </GlassCard>
      </div>
    </div>
  );
}
