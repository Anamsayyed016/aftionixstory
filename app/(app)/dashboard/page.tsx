import Link from "next/link";
import { Library, PenLine, Settings, Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { StoryStatusBadge } from "@/components/app/story-badges";

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats(user.id);
  const firstName = user.name?.split(" ")[0] || "Writer";

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
          Your stories, characters, and AI episode workspace live here. Open a
          story to generate and save episodes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total stories" value={stats.totalStories} />
        <Stat label="Active" value={stats.activeStories} />
        <Stat label="Drafts" value={stats.draftStories} />
        <Stat label="Characters" value={stats.totalCharacters} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Writing rules
          </p>
          <p className="mt-2 font-display text-3xl text-ink">
            {stats.activeWritingRules}
          </p>
          <p className="mt-1 text-xs text-ink-dim">Active across your stories</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Generations
          </p>
          <p className="mt-2 font-display text-3xl text-ink">
            {stats.monthlyGenerations}
            <span className="text-base text-ink-faint">
              /{stats.generationLimit}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-dim">Successful AI generations this month</p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Plan
          </p>
          <div className="mt-2">
            <Badge variant="violet">{stats.plan}</Badge>
          </div>
          <p className="mt-3 text-xs text-ink-dim">Billing not enabled</p>
        </GlassCard>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/create">
          <Button>
            <PenLine className="h-4 w-4" />
            Create New Story
          </Button>
        </Link>
        <Link href="/stories">
          <Button variant="secondary">
            <Library className="h-4 w-4" />
            View My Stories
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="ghost">
            <Settings className="h-4 w-4" />
            Open Settings
          </Button>
        </Link>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-ink">
            Continue writing
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Recent
          </span>
        </div>

        {stats.recentStories.length === 0 ? (
          <EmptyState
            icon={PenLine}
            title="No stories yet"
            description="Create a story with characters and writing rules to fill this board."
            actionHref="/create"
            actionLabel="Create Story"
          />
        ) : (
          <div className="grid gap-3">
            {stats.recentStories.map((story) => (
              <GlassCard
                key={story.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StoryStatusBadge status={story.status} />
                    <span className="font-mono text-[10px] text-ink-faint">
                      {story.genre}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-lg text-ink">{story.title}</p>
                  <p className="font-mono text-[10px] text-ink-faint">
                    {story._count.characters} characters · updated{" "}
                    {story.updatedAt.toLocaleDateString()}
                  </p>
                </div>
                <Link href={`/stories/${story.id}`}>
                  <Button variant="secondary" size="sm">
                    Open
                  </Button>
                </Link>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <GlassCard className="flex items-start gap-3 p-5">
        <Sparkles className="mt-0.5 h-4 w-4 text-lilac" />
        <div>
          <h3 className="font-display text-lg text-ink">Coming next</h3>
          <p className="mt-1 text-sm text-ink-dim">
            Persistent memories and plot threads arrive in a later phase.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard className="p-5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </GlassCard>
  );
}
