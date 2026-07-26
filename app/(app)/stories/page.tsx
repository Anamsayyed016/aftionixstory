import Link from "next/link";
import { ArrowRight, Library, Plus } from "lucide-react";
import type { StoryStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { listUserStories } from "@/lib/data/stories";
import { getDashboardStats } from "@/lib/data/dashboard";
import { EmptyState } from "@/components/app/empty-state";
import { StoryCard } from "@/components/app/story-card";
import { StoryStatusBadge } from "@/components/app/story-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; genre?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const statusParam = params.status;
  const status =
    statusParam === "DRAFT" ||
    statusParam === "ACTIVE" ||
    statusParam === "ARCHIVED" ||
    statusParam === "ALL"
      ? (statusParam as StoryStatus | "ALL")
      : "ALL";

  const [result, stats] = await Promise.all([
    listUserStories(user.id, {
      q: params.q,
      status,
      genre: params.genre,
      page: params.page ? Number(params.page) : 1,
    }),
    getDashboardStats(user.id),
  ]);
  const currentProject = stats.recentStories[0];
  const goalProgress = Math.min(
    100,
    Math.round((stats.monthlyGenerations / Math.max(1, stats.generationLimit)) * 100)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
            Library
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            My Stories
          </h2>
          <p className="mt-2 text-sm text-ink-dim">
            {result.total} stor{result.total === 1 ? "y" : "ies"} in your workspace.
          </p>
        </div>
        <Link href="/dashboard">
          <Button>
            <Plus className="h-4 w-4" />
            Create Story
          </Button>
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {currentProject ? (
          <GlassCard hover className="sm:col-span-2 flex flex-col justify-between p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StoryStatusBadge status={currentProject.status} />
                <Badge variant="outline">{currentProject.genre}</Badge>
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Continue writing
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">
                {currentProject.title}
              </h3>
            </div>
            <Link
              href={`/stories/${currentProject.id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet hover:underline"
            >
              Open workspace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </GlassCard>
        ) : (
          <div className="sm:col-span-2" />
        )}
        <GlassCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            This month
          </p>
          <p className="mt-2 font-display text-3xl text-ink">
            {stats.monthlyGenerations}
            <span className="text-base text-ink-faint">/{stats.generationLimit}</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-charcoal">
            <div
              className="h-full rounded-full bg-violet transition-[width] duration-500"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="mt-3 font-mono text-[10px] text-ink-faint">
            {stats.totalStories} stories · {stats.totalCharacters} characters
          </p>
        </GlassCard>
      </section>

      <form className="flex flex-col gap-3 rounded-xl border border-border bg-panel/40 p-4 sm:flex-row">
        <input
          name="q"
          defaultValue={params.q || ""}
          placeholder="Search titles…"
          className="h-10 flex-1 rounded-md border border-border bg-charcoal px-3 text-sm text-ink"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-border bg-charcoal px-3 text-sm text-ink"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <input
          name="genre"
          defaultValue={params.genre || ""}
          placeholder="Genre filter"
          className="h-10 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink sm:w-40"
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {result.stories.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No stories yet"
          description="Create your first story with characters, relationships, and writing rules. AI episodes come later."
          actionHref="/dashboard"
          actionLabel="Create Story"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {result.stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}

      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2 font-mono text-xs text-ink-dim">
          <span>
            Page {result.page} of {result.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
