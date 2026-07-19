"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleDashed } from "lucide-react";

import {
  summarizeStoryProgress,
  type StoryEssentialChip,
} from "@/lib/chat/story-progress";
import type { NormalizedChatStoryDraft } from "@/lib/chat/create-story-extraction";
import { cn } from "@/lib/utils";

type StoryProgressProps = {
  story: NormalizedChatStoryDraft | null;
  className?: string;
  defaultExpanded?: boolean;
};

function Chip({ chip }: { chip: StoryEssentialChip }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        chip.collected
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-charcoal/50 text-ink-faint"
      )}
    >
      {chip.collected ? (
        <Check className="h-3 w-3" aria-hidden />
      ) : (
        <CircleDashed className="h-3 w-3" aria-hidden />
      )}
      {chip.label}
      {chip.collected ? " ✓" : " missing"}
    </span>
  );
}

export function StoryProgress({
  story,
  className,
  defaultExpanded = false,
}: StoryProgressProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const summary = summarizeStoryProgress(story);

  if (summary.collected === 0 && !story) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b border-border/60 bg-panel/40 px-3 py-2 sm:px-4",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac"
        aria-expanded={expanded}
        aria-controls="story-progress-chips"
      >
        <p className="text-xs text-ink-dim">{summary.label}</p>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-faint transition-transform",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          id="story-progress-chips"
          className="mt-2 flex flex-wrap gap-1.5 px-1 pb-1"
        >
          {summary.chips.map((chip) => (
            <Chip key={chip.key} chip={chip} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
