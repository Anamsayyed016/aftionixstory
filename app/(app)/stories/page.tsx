import Link from "next/link";
import { Library, Plus } from "lucide-react";
import type { StoryStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { listUserStories } from "@/lib/data/stories";
import { EmptyState } from "@/components/app/empty-state";
import { StoryCard } from "@/components/app/story-card";
import { Button } from "@/components/ui/button";

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

  const result = await listUserStories(user.id, {
    q: params.q,
    status,
    genre: params.genre,
    page: params.page ? Number(params.page) : 1,
  });

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
        <Link href="/stories/new">
          <Button>
            <Plus className="h-4 w-4" />
            Create Story
          </Button>
        </Link>
      </div>

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
          actionHref="/stories/new"
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
