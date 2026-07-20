"use client";

import { useCallback, useId, useRef, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import {
  CREATE_PROMPT_MAX_CHARS,
  canSubmitCreatePrompt,
} from "@/lib/create/story-starters";
import { cn } from "@/lib/utils";

type CreatePromptComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function CreatePromptComposer({
  value,
  onChange,
  onSubmit,
}: CreatePromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelId = useId();
  const hintId = useId();
  const canSubmit = canSubmitCreatePrompt(value);
  const length = value.length;
  const nearLimit = length > CREATE_PROMPT_MAX_CHARS * 0.9;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (canSubmit) onSubmit();
    },
    [canSubmit, onSubmit]
  );

  return (
    <GlassCard className="mx-auto w-full max-w-[800px] overflow-hidden p-3 shadow-[0_24px_60px_-40px_rgba(124,92,255,0.45)] sm:p-4">
      <label htmlFor={labelId} className="sr-only">
        Story idea
      </label>
      <div
        className={cn(
          "rounded-xl border border-border bg-charcoal/60 p-3 transition-colors",
          "focus-within:border-violet-soft/55 focus-within:ring-2 focus-within:ring-lilac/20"
        )}
      >
        <textarea
          id={labelId}
          ref={textareaRef}
          rows={3}
          value={value}
          maxLength={CREATE_PROMPT_MAX_CHARS}
          placeholder="Describe your idea… for example, a slow-burn romance between a guarded college owner and an ambitious student."
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[88px] w-full resize-none bg-transparent text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none sm:min-h-[104px] sm:text-[15px]"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            id={hintId}
            className={cn(
              "font-mono text-[10px] tracking-wider text-ink-faint",
              nearLimit && "text-warning",
              length >= CREATE_PROMPT_MAX_CHARS && "text-danger"
            )}
          >
            {length}/{CREATE_PROMPT_MAX_CHARS} · Enter to start · Shift+Enter for
            a new line
          </p>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="rounded-xl"
              disabled={!canSubmit}
              onClick={onSubmit}
              aria-label="Start with Story Assistant"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              Start with Story Assistant
            </Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
