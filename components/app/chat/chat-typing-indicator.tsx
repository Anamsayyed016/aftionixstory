"use client";

import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type ChatTypingIndicatorProps = {
  label?: string;
  className?: string;
};

export function ChatTypingIndicator({
  label = "Thinking about your story…",
  className,
}: ChatTypingIndicatorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn("flex items-start gap-2.5", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-panel-raised text-lilac"
        aria-hidden
      >
        <span className="relative flex h-2 w-6 items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full bg-lilac/80",
                !reduceMotion && "animate-pulse"
              )}
              style={
                reduceMotion
                  ? undefined
                  : { animationDelay: `${i * 160}ms` }
              }
            />
          ))}
        </span>
      </span>
      <div className="max-w-[min(32rem,85%)] rounded-2xl rounded-bl-md border border-border bg-panel-raised/90 px-3.5 py-2.5 text-sm text-ink-dim">
        {label}
      </div>
    </div>
  );
}
