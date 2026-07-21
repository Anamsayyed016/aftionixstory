"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { type ThemePreference, useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Use light theme", icon: Sun },
  { value: "dark", label: "Use dark theme", icon: Moon },
  { value: "system", label: "Use system theme", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-panel p-1", className)} aria-label="Appearance" role="group">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={preference === value}
          onClick={() => setPreference(value)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-[color,background-color,box-shadow,transform] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac",
            preference === value ? "bg-panel-raised text-ink shadow-sm" : "text-ink-faint hover:bg-charcoal hover:text-ink"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
