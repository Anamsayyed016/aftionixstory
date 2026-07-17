"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  RefreshCw,
} from "lucide-react";

import {
  deleteEpisodeAction,
  generateEpisodeAction,
  regenerateEpisodeAction,
  saveEpisodeAction,
} from "@/app/actions/episodes";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

type EpisodeListItem = {
  id: string;
  episodeNumber: number;
  title: string;
  summary: string | null;
  wordCount: number;
  createdAt: string | Date;
};

type DraftState = {
  title: string;
  content: string;
  wordCount: number;
  clientRequestId: string;
  action: string;
  replaceEpisodeId?: string;
  dirty: boolean;
} | null;

const ACTIONS = [
  { value: "NEW_EPISODE", label: "Generate Episode" },
  { value: "CONTINUE", label: "Continue Story" },
  { value: "REGENERATE", label: "Regenerate" },
  { value: "IMPROVE_WRITING", label: "Improve Writing" },
  { value: "MORE_ROMANTIC", label: "More Romantic" },
  { value: "MORE_EMOTIONAL", label: "More Emotional" },
  { value: "ADD_COMEDY", label: "Add Comedy" },
] as const;

function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function StoryWorkspaceClient({
  storyId,
  storyTitle,
  storyStatus,
  currentSummary,
  episodes,
  characters,
  relationships,
  writingRules,
  overview,
}: {
  storyId: string;
  storyTitle: string;
  storyStatus: string;
  currentSummary: string | null;
  episodes: EpisodeListItem[];
  characters: Array<{ id: string; name: string; role: string }>;
  relationships: Array<{
    id: string;
    label: string;
    type: string;
  }>;
  writingRules: Array<{ id: string; rule: string; priority: number }>;
  overview: {
    setting: string | null;
    timePeriod: string | null;
    mainConflict: string | null;
    initialPlot: string | null;
    worldRules: string | null;
    contentBoundaries: string | null;
    writingStyle: string | null;
    pointOfView: string | null;
    pacing: string | null;
    episodeLength: string | null;
  };
}) {
  const router = useRouter();
  const [instruction, setInstruction] = React.useState("");
  const [action, setAction] = React.useState<(typeof ACTIONS)[number]["value"]>(
    "NEW_EPISODE"
  );
  const [toneOverride, setToneOverride] = React.useState("");
  const [lengthOverride, setLengthOverride] = React.useState("");
  const [selectedEpisodeId, setSelectedEpisodeId] = React.useState<string | null>(
    episodes[episodes.length - 1]?.id ?? null
  );
  const [draft, setDraft] = React.useState<DraftState>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = React.useState(false);
  const pendingGenerateRef = React.useRef<null | (() => Promise<void>)>(null);

  const archived = storyStatus === "ARCHIVED";
  const selected = episodes.find((e) => e.id === selectedEpisodeId) ?? null;

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(`sv-draft:${storyId}`);
        if (!raw) return;
        const parsed = JSON.parse(raw) as DraftState;
        if (parsed?.title && parsed?.content && parsed?.clientRequestId) {
          setDraft({ ...parsed, dirty: false });
        }
        sessionStorage.removeItem(`sv-draft:${storyId}`);
      } catch {
        // ignore malformed draft payloads
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storyId]);

  async function runGenerate(opts?: { forceReplaceDraft?: boolean }) {
    if (loading || archived) return;
    if (draft?.dirty && !opts?.forceReplaceDraft) {
      pendingGenerateRef.current = () => runGenerate({ forceReplaceDraft: true });
      setReplaceConfirmOpen(true);
      return;
    }

    setError(null);
    setWarning(null);
    setLoading(true);
    try {
      const clientRequestId = newRequestId();
      const sourceEpisodeId =
        action === "REGENERATE" ||
        action === "IMPROVE_WRITING" ||
        action === "MORE_ROMANTIC" ||
        action === "MORE_EMOTIONAL" ||
        action === "ADD_COMEDY"
          ? selectedEpisodeId ?? undefined
          : action === "CONTINUE"
            ? selectedEpisodeId ?? undefined
            : undefined;

      const result =
        action === "REGENERATE" && selectedEpisodeId
          ? await regenerateEpisodeAction({
              storyId,
              sourceEpisodeId: selectedEpisodeId,
              userInstruction:
                instruction.trim() ||
                "Regenerate this episode while preserving continuity.",
              action: "REGENERATE",
              toneOverride: toneOverride || undefined,
              lengthOverride: lengthOverride || undefined,
              clientRequestId,
            })
          : await generateEpisodeAction({
              storyId,
              userInstruction: instruction.trim(),
              action,
              toneOverride: toneOverride || undefined,
              lengthOverride: lengthOverride || undefined,
              sourceEpisodeId,
              clientRequestId,
            });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setDraft({
        title: result.data.title,
        content: result.data.content,
        wordCount: result.data.wordCount,
        clientRequestId: result.data.clientRequestId,
        action: result.data.action,
        replaceEpisodeId: result.data.replaceEpisodeId,
        dirty: false,
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!draft || saving || archived) return;
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const result = await saveEpisodeAction({
        storyId,
        title: draft.title,
        content: draft.content,
        userInstruction: instruction || undefined,
        generationAction: draft.action as
          | "NEW_EPISODE"
          | "CONTINUE"
          | "REGENERATE"
          | "IMPROVE_WRITING"
          | "MORE_ROMANTIC"
          | "MORE_EMOTIONAL"
          | "ADD_COMEDY",
        clientRequestId: draft.clientRequestId,
        replaceEpisodeId: draft.replaceEpisodeId,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      if (result.data.warning || result.message) {
        setWarning(result.data.warning || result.message || null);
      }
      setDraft(null);
      setSelectedEpisodeId(result.data.episodeId);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteEpisode(episodeId: string) {
    const result = await deleteEpisodeAction({ episodeId });
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    if (result.data.warning) setWarning(result.data.warning);
    if (selectedEpisodeId === episodeId) setSelectedEpisodeId(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
      <GlassCard className="space-y-4 p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Episodes
          </p>
          <p className="mt-1 truncate text-sm font-medium text-ink">{storyTitle}</p>
          <Badge variant="outline" className="mt-2">
            {storyStatus}
          </Badge>
        </div>

        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {episodes.length === 0 && (
            <li className="rounded-md border border-dashed border-border bg-charcoal/40 p-3 text-sm text-ink-dim">
              No saved episodes yet. Generate a draft, then click Save Episode.
            </li>
          )}
          {episodes.map((ep) => (
            <li key={ep.id}>
              <button
                type="button"
                onClick={() => setSelectedEpisodeId(ep.id)}
                className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                  selectedEpisodeId === ep.id
                    ? "bg-panel-raised text-ink"
                    : "bg-charcoal/40 text-ink-dim hover:bg-white/5 hover:text-ink"
                }`}
              >
                <p className="font-mono text-[10px] text-ink-faint">
                  Ep {ep.episodeNumber}
                </p>
                <p className="truncate text-sm">{ep.title}</p>
              </button>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[10px] text-ink-faint">
          Saved episodes: {episodes.length}
        </p>
      </GlassCard>

      <div className="space-y-4">
        <GlassCard className="space-y-4 p-5">
          <h3 className="font-display text-xl font-semibold text-ink">Overview</h3>
          <Meta label="Setting" value={overview.setting} />
          <Meta label="Time period" value={overview.timePeriod} />
          <Meta label="Main conflict" value={overview.mainConflict} />
          <Meta label="Initial plot" value={overview.initialPlot} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Meta label="Writing style" value={overview.writingStyle} />
            <Meta label="POV" value={overview.pointOfView} />
            <Meta label="Pacing" value={overview.pacing} />
            <Meta label="Episode length" value={overview.episodeLength} />
          </div>
        </GlassCard>

        <GlassCard className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lilac" />
            <h3 className="font-display text-lg font-semibold text-ink">
              Story composer
            </h3>
          </div>

          <label className="block space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Instruction
            </span>
            <textarea
              rows={4}
              value={instruction}
              disabled={loading || archived}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink"
              placeholder="Describe what should happen in the next episode..."
              aria-label="Episode instruction"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1.5 sm:col-span-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Action
              </span>
              <select
                value={action}
                disabled={loading || archived}
                onChange={(e) =>
                  setAction(e.target.value as (typeof ACTIONS)[number]["value"])
                }
                className="w-full rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink"
                aria-label="Generation action"
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Tone override
              </span>
              <input
                value={toneOverride}
                disabled={loading || archived}
                onChange={(e) => setToneOverride(e.target.value)}
                className="w-full rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink"
                maxLength={100}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Length override
              </span>
              <input
                value={lengthOverride}
                disabled={loading || archived}
                onChange={(e) => setLengthOverride(e.target.value)}
                className="w-full rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink"
                maxLength={100}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={loading}
              disabled={archived || instruction.trim().length < 3}
              onClick={() => void runGenerate()}
            >
              <Sparkles className="h-4 w-4" />
              {ACTIONS.find((a) => a.value === action)?.label || "Generate"}
            </Button>
            {selected && (
              <Button
                type="button"
                variant="secondary"
                disabled={loading || archived}
                onClick={() => {
                  setAction("REGENERATE");
                  void runGenerate();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate selected
              </Button>
            )}
          </div>

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
          {archived && (
            <p className="text-sm text-ink-dim">
              This story is archived. Generation and edits are disabled.
            </p>
          )}
        </GlassCard>

        {draft && (
          <GlassCard className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-rose">
                  Unsaved draft
                  {draft.replaceEpisodeId ? " · replaces saved episode" : ""}
                </p>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {draft.title}
                </h3>
              </div>
              <p className="font-mono text-xs text-ink-faint">
                {draft.wordCount} words
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Title
              </span>
              <input
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value, dirty: true })
                }
                className="w-full rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Content
              </span>
              <textarea
                rows={16}
                value={draft.content}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    content: e.target.value,
                    wordCount: e.target.value.trim().split(/\s+/).filter(Boolean).length,
                    dirty: true,
                  })
                }
                className="w-full whitespace-pre-wrap rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm leading-relaxed text-ink"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" loading={saving} onClick={() => void onSave()}>
                <Save className="h-4 w-4" />
                Save Episode
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setDiscardOpen(true)}
              >
                Discard
              </Button>
            </div>
          </GlassCard>
        )}

        {!draft && selected && (
          <GlassCard className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] text-ink-faint">
                  Episode {selected.episodeNumber}
                </p>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {selected.title}
                </h3>
              </div>
              <Link href={`/stories/${storyId}/episodes/${selected.id}`}>
                <Button variant="secondary" size="sm">
                  Open / edit
                </Button>
              </Link>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink-dim">
              {selected.summary || "No summary yet."}
            </p>
          </GlassCard>
        )}
      </div>

      <div className="space-y-4">
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Characters
            </p>
            <Link
              href={`/stories/${storyId}/characters`}
              className="text-xs text-lilac hover:underline"
            >
              Manage
            </Link>
          </div>
          <ul className="space-y-2">
            {characters.slice(0, 6).map((c) => (
              <li key={c.id} className="rounded-md bg-charcoal/50 px-3 py-2">
                <p className="text-sm text-ink">{c.name}</p>
                <p className="font-mono text-[10px] text-ink-faint">{c.role}</p>
              </li>
            ))}
            {characters.length === 0 && (
              <li className="text-sm text-ink-dim">No active characters.</li>
            )}
          </ul>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Relationships
          </p>
          <ul className="space-y-2 text-sm text-ink-dim">
            {relationships.slice(0, 5).map((r) => (
              <li key={r.id}>
                {r.label}
                <span className="block font-mono text-[10px] text-ink-faint">
                  {r.type}
                </span>
              </li>
            ))}
            {relationships.length === 0 && <li>None yet.</li>}
          </ul>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Writing rules
          </p>
          <ul className="space-y-2 text-sm text-ink-dim">
            {writingRules.slice(0, 6).map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="font-mono text-[10px] text-violet-soft">
                  P{r.priority}
                </span>
                <span>{r.rule}</span>
              </li>
            ))}
            {writingRules.length === 0 && <li>No active rules.</li>}
          </ul>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-rose" />
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Story summary
            </p>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink-dim">
            {currentSummary ||
              "No summary yet. Summaries update when episodes are saved."}
          </p>
        </GlassCard>
      </div>

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved draft?"
        description="This generated episode has not been saved. Discarding cannot be undone."
        confirmLabel="Discard"
        onConfirm={() => {
          setDraft(null);
          setDiscardOpen(false);
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      <ConfirmDialog
        open={replaceConfirmOpen}
        title="Replace current draft?"
        description="You have unsaved edits on the current draft. Generating again will replace it."
        confirmLabel="Replace draft"
        onConfirm={() => {
          setReplaceConfirmOpen(false);
          const fn = pendingGenerateRef.current;
          pendingGenerateRef.current = null;
          if (fn) void fn();
        }}
        onCancel={() => {
          setReplaceConfirmOpen(false);
          pendingGenerateRef.current = null;
        }}
      />

      {/* Keep delete confirmation simple via window.confirm for list actions */}
      {selected && (
        <div className="sr-only">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Delete this episode? Episode numbers will not be renumbered. Continuity summary will be rebuilt."
                )
              ) {
                void onDeleteEpisode(selected.id);
              }
            }}
          >
            <Trash2 />
          </button>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm text-ink shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-lilac" />
          Generating episode…
        </div>
      )}
    </div>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
