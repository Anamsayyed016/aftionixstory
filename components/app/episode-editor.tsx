"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  deleteEpisodeAction,
  regenerateEpisodeAction,
  updateEpisodeAction,
} from "@/app/actions/episodes";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

type VersionRow = {
  id: string;
  versionNumber: number;
  title: string | null;
  changeReason: string | null;
  createdAt: string;
  preview: string;
};

export function EpisodeEditor({
  storyId,
  episodeId,
  episodeNumber,
  initialTitle,
  initialContent,
  summary,
  wordCount,
  version,
  previous,
  next,
  versions,
}: {
  storyId: string;
  episodeId: string;
  episodeNumber: number;
  initialTitle: string;
  initialContent: string;
  summary: string | null;
  wordCount: number;
  version: number;
  previous: { id: string; episodeNumber: number; title: string } | null;
  next: { id: string; episodeNumber: number; title: string } | null;
  versions: VersionRow[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initialTitle);
  const [content, setContent] = React.useState(initialContent);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [regenLoading, setRegenLoading] = React.useState(false);

  const dirty =
    title !== initialTitle || content !== initialContent;

  async function onSave() {
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const result = await updateEpisodeAction({
        episodeId,
        title,
        content,
        changeReason: "manual_edit",
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      if (result.data.warning) setWarning(result.data.warning);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onRegenerate() {
    setRegenLoading(true);
    setError(null);
    try {
      const clientRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "")
          : `req_${Date.now()}`;
      const result = await regenerateEpisodeAction({
        storyId,
        sourceEpisodeId: episodeId,
        userInstruction:
          "Regenerate this episode with improved quality while preserving continuity.",
        action: "REGENERATE",
        clientRequestId,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      // Return to workspace with draft via sessionStorage
      sessionStorage.setItem(
        `sv-draft:${storyId}`,
        JSON.stringify({
          title: result.data.title,
          content: result.data.content,
          wordCount: result.data.wordCount,
          clientRequestId: result.data.clientRequestId,
          action: result.data.action,
          replaceEpisodeId: result.data.replaceEpisodeId,
        })
      );
      router.push(`/stories/${storyId}`);
    } finally {
      setRegenLoading(false);
    }
  }

  async function onDelete() {
    const result = await deleteEpisodeAction({ episodeId });
    if (!result.success) {
      setError(result.error.message);
      setDeleteOpen(false);
      return;
    }
    router.push(`/stories/${storyId}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Episode {episodeNumber} · v{version} · {wordCount} words
          </p>
          <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/stories/${storyId}`}>
            <Button variant="secondary">Back to workspace</Button>
          </Link>
          {previous && (
            <Link href={`/stories/${storyId}/episodes/${previous.id}`}>
              <Button variant="ghost" size="sm">
                ← Ep {previous.episodeNumber}
              </Button>
            </Link>
          )}
          {next && (
            <Link href={`/stories/${storyId}/episodes/${next.id}`}>
              <Button variant="ghost" size="sm">
                Ep {next.episodeNumber} →
              </Button>
            </Link>
          )}
        </div>
      </div>

      <GlassCard className="space-y-4 p-5">
        <label className="block space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink"
            aria-label="Episode title"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Content
          </span>
          <textarea
            rows={20}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full whitespace-pre-wrap rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm leading-relaxed text-ink"
            aria-label="Episode content"
          />
        </label>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {warning && (
          <p className="rounded-md border border-border bg-panel/60 px-3 py-2 text-sm text-ink-dim">
            {warning}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            loading={saving}
            disabled={!dirty}
            onClick={() => void onSave()}
          >
            Save changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={regenLoading}
            onClick={() => void onRegenerate()}
          >
            Regenerate (unsaved draft)
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
          >
            Delete episode
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h3 className="font-display text-lg font-semibold text-ink">Summary</h3>
        <p className="whitespace-pre-wrap text-sm text-ink-dim">
          {summary || "No summary yet."}
        </p>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h3 className="font-display text-lg font-semibold text-ink">
          Version history
        </h3>
        {versions.length === 0 ? (
          <p className="text-sm text-ink-dim">No prior versions yet.</p>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => (
              <li
                key={v.id}
                className="rounded-md border border-border/80 bg-charcoal/40 px-3 py-2"
              >
                <p className="font-mono text-[10px] text-ink-faint">
                  v{v.versionNumber} · {new Date(v.createdAt).toLocaleString()} ·{" "}
                  {v.changeReason || "edit"}
                </p>
                <p className="text-sm text-ink">{v.title || "Untitled"}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-ink-dim">
                  {v.preview}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this episode?"
        description="Episode numbers will not be renumbered. Story continuity summary will be rebuilt from remaining episodes."
        confirmLabel="Delete"
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
