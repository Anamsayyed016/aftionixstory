"use client";

import { ContinueStoryToolbar } from "@/components/app/chat/continue-story-toolbar";
import type { ContinueDraftState } from "@/components/app/chat/continue-story-toolbar";
import { isCreateEnabledForDraft } from "@/lib/chat/continue-story-intent";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-border bg-charcoal/60 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft focus:outline-none focus:ring-2 focus:ring-lilac/25";

type ContinueStoryDraftProps = {
  draft: ContinueDraftState;
  busy: boolean;
  saving: boolean;
  archived: boolean;
  error?: string | null;
  onChange: (next: ContinueDraftState) => void;
  onRegenerate: () => void;
  onSave: () => void;
  onDiscard: () => void;
  className?: string;
};

export function ContinueStoryDraft({
  draft,
  busy,
  saving,
  archived,
  error,
  onChange,
  onRegenerate,
  onSave,
  onDiscard,
  className,
}: ContinueStoryDraftProps) {
  const canSave = isCreateEnabledForDraft({
    title: draft.title,
    content: draft.content,
  });

  return (
    <section
      aria-label="Unsaved episode draft"
      className={cn(
        "space-y-4 rounded-2xl border border-border bg-panel/75 p-4 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-rose">
            Not saved yet
            {draft.replaceEpisodeId ? " · may replace a saved episode" : ""}
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink">
            Episode {draft.proposedEpisodeNumber} draft
          </h3>
          <p className="mt-1 text-xs text-ink-dim">
            Action: {draft.action.replaceAll("_", " ")} · {draft.wordCount}{" "}
            words
          </p>
        </div>
        <span className="rounded-full border border-border bg-charcoal/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-violet-soft">
          Draft
        </span>
      </div>

      <label className="block space-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Title
        </span>
        <input
          className={inputClass}
          value={draft.title}
          disabled={busy || saving || archived}
          onChange={(e) =>
            onChange({ ...draft, title: e.target.value, dirty: true })
          }
          aria-label="Draft episode title"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Content
        </span>
        <textarea
          rows={14}
          className={cn(inputClass, "whitespace-pre-wrap leading-relaxed")}
          value={draft.content}
          disabled={busy || saving || archived}
          onChange={(e) => {
            const content = e.target.value;
            onChange({
              ...draft,
              content,
              wordCount: content.trim().split(/\s+/).filter(Boolean).length,
              dirty: true,
            });
          }}
          aria-label="Draft episode content"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {archived ? (
        <p className="text-sm text-ink-dim">
          This story is archived. Generation and saves are disabled.
        </p>
      ) : null}

      <ContinueStoryToolbar
        busy={busy}
        saving={saving}
        canSave={canSave}
        archived={archived}
        onRegenerate={onRegenerate}
        onSave={onSave}
        onDiscard={onDiscard}
      />

      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        Tip: send another chat message to revise (e.g. “Add more comedy and
        include Sara”).
      </p>
    </section>
  );
}
