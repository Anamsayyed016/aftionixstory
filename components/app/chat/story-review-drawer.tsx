"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { StoryCreationPreview } from "@/components/app/chat/story-creation-preview";
import type { NormalizedChatStoryDraft } from "@/lib/chat/create-story-extraction";
import { cn } from "@/lib/utils";

type StoryReviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  story: NormalizedChatStoryDraft;
  status: "complete" | "needs_more_info";
  missing: string[];
  creating: boolean;
  createEnabled: boolean;
  onChange: (next: NormalizedChatStoryDraft) => void;
  onCreate: () => void;
  error?: string | null;
};

export function StoryReviewDrawer({
  open,
  onClose,
  story,
  status,
  missing,
  creating,
  createEnabled,
  onChange,
  onCreate,
  error,
}: StoryReviewDrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-void/70 backdrop-blur-sm"
        aria-label="Close story review"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl border border-border bg-panel shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(100%,28rem)] md:rounded-none md:rounded-l-2xl md:border-y-0 md:border-r-0"
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-lg font-semibold tracking-tight text-ink"
            >
              Review Story
            </h2>
            <p className="text-xs text-ink-dim">
              Edit details anytime. Closing keeps your changes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className="rounded-lg border border-border p-2 text-ink-dim hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <StoryCreationPreview
            story={story}
            status={status}
            missing={missing}
            creating={creating}
            createEnabled={createEnabled}
            onChange={onChange}
            onCreate={onCreate}
            onContinueChatting={onClose}
            error={error}
            variant="embedded"
          />
        </div>
      </div>
    </div>
  );
}
