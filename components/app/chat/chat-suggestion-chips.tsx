"use client";

import { cn } from "@/lib/utils";
import type { ChatSuggestion } from "@/lib/chat/types";

type ChatSuggestionChipsProps = {
  suggestions: ChatSuggestion[];
  onSelect: (suggestion: ChatSuggestion) => void;
  disabled?: boolean;
  className?: string;
};

export function ChatSuggestionChips({
  suggestions,
  onSelect,
  disabled = false,
  className,
}: ChatSuggestionChipsProps) {
  return (
    <div
      className={cn("flex flex-wrap justify-center gap-2", className)}
      role="list"
      aria-label="Suggested prompts"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          role="listitem"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className={cn(
            "rounded-full border border-border bg-panel-raised/70 px-3 py-1.5 text-left text-xs text-ink-dim transition-colors",
            "hover:border-violet-soft/50 hover:bg-panel-raised hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
