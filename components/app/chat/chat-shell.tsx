"use client";

import { Sparkles, X } from "lucide-react";

import { ChatComposer } from "@/components/app/chat/chat-composer";
import { ChatMessageList } from "@/components/app/chat/chat-message-list";
import { CHAT_SHELL_COPY } from "@/lib/chat/constants";
import type { ChatMessage, ChatMode, ChatSuggestion } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatShellProps = {
  mode: ChatMode;
  messages: ChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  suggestions: ChatSuggestion[];
  onSelectSuggestion: (suggestion: ChatSuggestion) => void;
  busy?: boolean;
  disabled?: boolean;
  storyTitle?: string;
  onClose?: () => void;
  className?: string;
  statusText?: string;
  badgeLabel?: string;
  footer?: React.ReactNode;
  historySlot?: React.ReactNode;
  persistHint?: string | null;
};

export function ChatShell({
  mode,
  messages,
  draft,
  onDraftChange,
  onSend,
  suggestions,
  onSelectSuggestion,
  busy = false,
  disabled = false,
  storyTitle,
  onClose,
  className,
  statusText,
  badgeLabel,
  footer,
  historySlot,
  persistHint,
}: ChatShellProps) {
  const copy = CHAT_SHELL_COPY[mode];
  const resolvedStatus =
    statusText ??
    (mode === "create"
      ? "Gemini helps collect story details. Nothing is saved until you create."
      : "AI connection will be enabled in the next phase.");
  const resolvedBadge =
    badgeLabel ?? (mode === "create" ? "Live" : "Demo UI");

  return (
    <section
      aria-label={copy.title}
      className={cn(
        "flex h-[min(70vh,640px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-panel/75 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.85)] backdrop-blur-md",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-lilac text-white shadow-[0_10px_24px_-12px_rgba(124,92,255,0.75)]">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-semibold tracking-tight text-ink">
                {copy.title}
              </h2>
              {storyTitle ? (
                <p className="truncate text-xs text-ink-dim">
                  Story: {storyTitle}
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-faint">{resolvedStatus}</p>
          {persistHint ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-violet-soft">
              {persistHint}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-border bg-charcoal/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-violet-soft">
            {resolvedBadge}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat assistant"
              className="rounded-lg border border-border p-2 text-ink-dim transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      {historySlot ? (
        <div className="border-b border-border/60 px-3 py-2 sm:px-4">
          {historySlot}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <ChatMessageList
          messages={messages}
          emptyTitle={copy.emptyTitle}
          emptyDescription={copy.emptyDescription}
          suggestions={suggestions}
          onSelectSuggestion={onSelectSuggestion}
          disabled={disabled || busy}
        />
      </div>

      {footer}

      <ChatComposer
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        placeholder={copy.placeholder}
        disabled={disabled}
        busy={busy}
      />
    </section>
  );
}
