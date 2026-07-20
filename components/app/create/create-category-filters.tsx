"use client";

import type { CreateCategory } from "@/lib/create/story-starters";
import { CREATE_CATEGORIES } from "@/lib/create/story-starters";
import { cn } from "@/lib/utils";

type CreateCategoryFiltersProps = {
  value: CreateCategory;
  onChange: (category: CreateCategory) => void;
};

export function CreateCategoryFilters({
  value,
  onChange,
}: CreateCategoryFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Story starter categories"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible"
    >
      {CREATE_CATEGORIES.map((category) => {
        const selected = value === category;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(category)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-void",
              selected
                ? "border-violet/40 bg-violet/15 text-violet-soft"
                : "border-border bg-panel/60 text-ink-faint hover:border-border-strong hover:text-ink-dim"
            )}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
