"use client";

import { useMemo, useState } from "react";

import { describeMemoryStatus } from "@/lib/story-agent/memory-patch";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { cn } from "@/lib/utils";

type StoryProgressProps = {
  memory: StoryMemory | null;
  statusText?: string | null;
  className?: string;
};

export function StoryProgress({
  memory,
  statusText,
  className,
}: StoryProgressProps) {
  const [expanded, setExpanded] = useState(false);
  const label = statusText || (memory ? describeMemoryStatus(memory) : null);

  const details = useMemo(() => {
    if (!memory) return [];
    const chips: string[] = [];
    if (memory.storyMemory.title) chips.push(`Title: ${memory.storyMemory.title}`);
    if (memory.characters.length) {
      chips.push(
        `Characters: ${memory.characters.map((c) => c.name).slice(0, 4).join(", ")}`
      );
    }
    if (memory.userPreferences.doNotStartYet) {
      chips.push("Holding off on writing");
    }
    if (memory.latestDraft?.content) chips.push("Unsaved episode draft");
    return chips;
  }, [memory]);

  if (!label) return null;

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
      >
        <p className="text-xs text-ink-dim">{label}</p>
        {details.length > 0 ? (
          <span className="text-[11px] text-ink-faint">
            {expanded ? "Hide" : "Details"}
          </span>
        ) : null}
      </button>
      {expanded && details.length > 0 ? (
        <ul className="mt-1 space-y-0.5 px-1 pb-1 text-[11px] text-ink-faint">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
