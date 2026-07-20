"use client";

import type { StoryStarter } from "@/lib/create/story-starters";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

const ACCENT_CHIP: Record<StoryStarter["accent"], string> = {
  primary: "bg-violet/15 text-violet-soft ring-1 ring-violet/25",
  rose: "bg-rose/12 text-rose ring-1 ring-rose/25",
  blue: "bg-lilac/10 text-lilac ring-1 ring-lilac/30",
};

type StoryStarterCardProps = {
  starter: StoryStarter;
  onSelect: (starter: StoryStarter) => void;
};

export function StoryStarterCard({ starter, onSelect }: StoryStarterCardProps) {
  const Icon = starter.icon;

  return (
    <GlassCard
      hover
      role="button"
      tabIndex={0}
      aria-label={`Use starter: ${starter.title}`}
      onClick={() => onSelect(starter)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(starter);
        }
      }}
      className={cn(
        "group flex h-full cursor-pointer flex-col gap-3 p-4",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg",
            ACCENT_CHIP[starter.accent]
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        {starter.category !== "All" ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {starter.category}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <h3 className="font-display text-base font-semibold text-ink group-hover:text-ink">
          {starter.title}
        </h3>
        <p className="text-sm leading-relaxed text-ink-dim">
          {starter.description}
        </p>
      </div>
    </GlassCard>
  );
}
