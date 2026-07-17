"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import * as React from "react";

import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import {
  StoryStatusBadge,
  StoryVisibilityBadge,
} from "@/components/app/story-badges";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  archiveStoryAction,
  deleteStoryAction,
  duplicateStoryAction,
} from "@/app/actions/stories";

type StoryCardStory = {
  id: string;
  title: string;
  description: string | null;
  genre: string;
  language: string;
  status: string;
  visibility: string;
  totalEpisodes: number;
  updatedAt: Date | string;
  _count: { characters: number };
};

export function StoryCard({ story }: { story: StoryCardStory }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"archive" | "delete" | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runAction(kind: "archive" | "delete" | "duplicate") {
    setLoading(true);
    setError(null);
    try {
      const result =
        kind === "archive"
          ? await archiveStoryAction(story.id)
          : kind === "delete"
            ? await deleteStoryAction(story.id)
            : await duplicateStoryAction(story.id);
      if (!result.success) {
        setError(result.error.message);
      } else if (kind === "duplicate" && result.data?.storyId) {
        window.location.href = `/stories/${result.data.storyId}/edit`;
      }
    } finally {
      setLoading(false);
      setConfirm(null);
      setMenuOpen(false);
    }
  }

  const updated =
    typeof story.updatedAt === "string"
      ? new Date(story.updatedAt)
      : story.updatedAt;

  return (
    <GlassCard hover className="relative flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StoryStatusBadge status={story.status} />
            <StoryVisibilityBadge visibility={story.visibility} />
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-ink">
            <Link href={`/stories/${story.id}`} className="hover:text-lilac">
              {story.title}
            </Link>
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {story.genre} · {story.language}
          </p>
        </div>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Story actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-border bg-panel-raised py-1 text-sm shadow-lg">
              <Link
                href={`/stories/${story.id}/edit`}
                className="block px-3 py-2 text-ink-dim hover:bg-white/5 hover:text-ink"
              >
                Edit
              </Link>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-ink-dim hover:bg-white/5 hover:text-ink"
                onClick={() => runAction("duplicate")}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-ink-dim hover:bg-white/5 hover:text-ink"
                onClick={() => setConfirm("archive")}
              >
                Archive
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-danger hover:bg-danger/10"
                onClick={() => setConfirm("delete")}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {story.description && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-dim">{story.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        <span>{story._count.characters} characters</span>
        <span>{story.totalEpisodes} episodes</span>
        <span>Updated {updated.toLocaleDateString()}</span>
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <div className="mt-5">
        <Link href={`/stories/${story.id}`}>
          <Button className="w-full" variant="secondary">
            Open workspace
          </Button>
        </Link>
      </div>

      <ConfirmDialog
        open={confirm === "archive"}
        title="Archive this story?"
        description="Archived stories stay in your library but are hidden from Active views."
        confirmLabel="Archive"
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runAction("archive")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this story?"
        description="This permanently removes the story, characters, relationships, and writing rules. Episodes and memories are not available yet in Phase B."
        confirmLabel="Delete forever"
        danger
        loading={loading}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runAction("delete")}
      />
    </GlassCard>
  );
}
