"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import type { ChatSuggestion } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatEmptyStateProps = {
  title: string;
  description: string;
  suggestions: ChatSuggestion[];
  onSelectSuggestion: (suggestion: ChatSuggestion) => void;
  disabled?: boolean;
};

export function ChatEmptyState({
  title,
  description,
  suggestions,
  onSelectSuggestion,
  disabled = false,
}: ChatEmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
      }
      className="flex h-full flex-col items-center justify-center px-4 py-10 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-panel-raised text-lilac">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {description}
      </p>
      <div
        className="mt-7 grid w-full max-w-xl gap-2 sm:grid-cols-2"
        role="list"
        aria-label="Suggested prompts"
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            role="listitem"
            disabled={disabled}
            onClick={() => onSelectSuggestion(suggestion)}
            className={cn(
              "rounded-2xl border border-border bg-panel-raised/60 px-3.5 py-3 text-left text-sm text-ink-dim transition-colors",
              "hover:border-violet-soft/45 hover:bg-panel-raised hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
