"use client";

import { Button } from "@/components/ui/button";
import type { NormalizedChatStoryDraft } from "@/lib/chat/create-story-extraction";
import { cn } from "@/lib/utils";

type StoryCreationPreviewProps = {
  story: NormalizedChatStoryDraft;
  status: "complete" | "needs_more_info";
  missing: string[];
  creating: boolean;
  createEnabled: boolean;
  onChange: (next: NormalizedChatStoryDraft) => void;
  onCreate: () => void;
  onContinueChatting?: () => void;
  error?: string | null;
  variant?: "panel" | "embedded";
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-charcoal/60 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft focus:outline-none focus:ring-2 focus:ring-lilac/25";

export function StoryCreationPreview({
  story,
  status,
  missing,
  creating,
  createEnabled,
  onChange,
  onCreate,
  onContinueChatting,
  error,
  variant = "panel",
}: StoryCreationPreviewProps) {
  function patch(partial: Partial<NormalizedChatStoryDraft>) {
    onChange({ ...story, ...partial });
  }

  function updateCharacter(
    index: number,
    partial: Partial<NormalizedChatStoryDraft["characters"][number]>
  ) {
    const characters = story.characters.map((c, i) =>
      i === index ? { ...c, ...partial } : c
    );
    patch({ characters });
  }

  const friendlyMissing = missing
    .map((item) => {
      if (item === "characters") return "main character";
      if (item.includes(".")) return item.split(".").pop() ?? item;
      return item;
    })
    .slice(0, 6);

  return (
    <section
      aria-label="Story preview"
      className={cn(
        "space-y-4",
        variant === "panel" &&
          "rounded-2xl border border-border bg-panel/75 p-4 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-5"
      )}
    >
      {variant === "panel" ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-violet-soft">Preview</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink">
              Review before creating
            </h3>
            <p className="mt-1 text-sm text-ink-dim">
              Edit any field. Create Story unlocks when required details are
              complete.
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              status === "complete"
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-charcoal/70 text-ink-faint"
            )}
          >
            {status === "complete" ? "Ready" : "Needs more info"}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              status === "complete"
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-charcoal/70 text-ink-faint"
            )}
          >
            {status === "complete" ? "Ready to create" : "Still collecting details"}
          </span>
        </div>
      )}

      {friendlyMissing.length > 0 ? (
        <p className="rounded-xl border border-border bg-charcoal/50 px-3 py-2 text-xs text-ink-dim">
          Still helpful to add: {friendlyMissing.join(", ")}
          {missing.length > 6 ? "…" : ""}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input
            className={inputClass}
            value={story.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>
        <Field label="Genre">
          <input
            className={inputClass}
            value={story.genre ?? ""}
            onChange={(e) => patch({ genre: e.target.value })}
          />
        </Field>
        <Field label="Language">
          <input
            className={inputClass}
            value={story.language ?? ""}
            onChange={(e) => patch({ language: e.target.value })}
          />
        </Field>
        <Field label="Tone">
          <input
            className={inputClass}
            value={story.tone ?? ""}
            onChange={(e) => patch({ tone: e.target.value })}
          />
        </Field>
        <Field label="POV">
          <input
            className={inputClass}
            value={story.pointOfView ?? ""}
            onChange={(e) => patch({ pointOfView: e.target.value })}
          />
        </Field>
        <Field label="Writing style">
          <input
            className={inputClass}
            value={story.writingStyle ?? ""}
            onChange={(e) => patch({ writingStyle: e.target.value })}
          />
        </Field>
        <Field label="Pacing">
          <input
            className={inputClass}
            value={story.pacing ?? ""}
            onChange={(e) => patch({ pacing: e.target.value })}
          />
        </Field>
        <Field label="Audience / type">
          <input
            className={inputClass}
            value={story.storyType ?? ""}
            onChange={(e) => patch({ storyType: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Synopsis">
        <textarea
          rows={3}
          className={inputClass}
          value={story.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
      <Field label="Setting">
        <textarea
          rows={2}
          className={inputClass}
          value={story.setting ?? ""}
          onChange={(e) => patch({ setting: e.target.value })}
        />
      </Field>
      <Field label="Plot">
        <textarea
          rows={3}
          className={inputClass}
          value={story.initialPlot ?? ""}
          onChange={(e) => patch({ initialPlot: e.target.value })}
        />
      </Field>

      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          Characters
        </p>
        {story.characters.length === 0 ? (
          <p className="text-sm text-ink-dim">
            No characters yet — keep chatting to add them.
          </p>
        ) : (
          story.characters.map((character, index) => (
            <div
              key={character.clientId ?? `char-${index}`}
              className="grid gap-2 rounded-xl border border-border bg-charcoal/40 p-3 sm:grid-cols-2"
            >
              <Field label="Name">
                <input
                  className={inputClass}
                  value={character.name}
                  onChange={(e) =>
                    updateCharacter(index, { name: e.target.value })
                  }
                />
              </Field>
              <Field label="Role">
                <input
                  className={inputClass}
                  value={character.role}
                  onChange={(e) =>
                    updateCharacter(index, { role: e.target.value })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Personality">
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={character.personality}
                    onChange={(e) =>
                      updateCharacter(index, { personality: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
          ))
        )}
      </div>

      {story.writingRules.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Writing rules
          </p>
          <ul className="space-y-1 text-sm text-ink-dim">
            {story.writingRules.map((rule, index) => (
              <li key={`${rule.rule}-${index}`}>• {rule.rule}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-2",
          onContinueChatting && "sm:flex-row-reverse"
        )}
      >
        <Button
          type="button"
          className="h-11 w-full rounded-xl sm:flex-1"
          disabled={!createEnabled || creating}
          loading={creating}
          onClick={onCreate}
        >
          Create Story
        </Button>
        {onContinueChatting ? (
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full rounded-xl sm:flex-1"
            disabled={creating}
            onClick={onContinueChatting}
          >
            Continue Chatting
          </Button>
        ) : null}
      </div>
    </section>
  );
}
