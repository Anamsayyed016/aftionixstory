"use client";

import { cn } from "@/lib/utils";

type ToggleOption<T extends string> = {
  id: T;
  label: string;
};

type ChatModeToggleProps<T extends string> = {
  value: T;
  options: readonly [ToggleOption<T>, ToggleOption<T>];
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

export function ChatModeToggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: ChatModeToggleProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex w-full max-w-md rounded-xl border border-border bg-charcoal/70 p-1",
        className
      )}
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`chat-mode-${option.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-void",
              selected
                ? "bg-panel-raised text-ink shadow-[0_8px_20px_-14px_rgba(124,92,255,0.65)]"
                : "text-ink-dim hover:bg-white/5 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
