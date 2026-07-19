"use client";

import { Archive, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export type ConversationHistoryItemData = {
  id: string;
  title: string | null;
  status: "ACTIVE" | "ARCHIVED";
  storyTitle?: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
};

type ConversationHistoryItemProps = {
  item: ConversationHistoryItemData;
  active: boolean;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function ConversationHistoryItem({
  item,
  active,
  onOpen,
  onArchive,
}: ConversationHistoryItemProps) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors",
        active
          ? "border-violet-soft/40 bg-panel-raised"
          : "border-transparent hover:border-border hover:bg-white/5"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac"
        aria-current={active ? "true" : undefined}
      >
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-lilac" aria-hidden />
          <p className="truncate text-sm font-medium text-ink">
            {item.title || "Untitled conversation"}
          </p>
        </div>
        {item.storyTitle ? (
          <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">
            {item.storyTitle}
          </p>
        ) : null}
        <p className="mt-1 truncate text-xs text-ink-dim">
          {item.lastMessagePreview || "No messages yet"}
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          {formatWhen(item.lastMessageAt)}
          {item.status === "ARCHIVED" ? " · Archived" : ""}
        </p>
      </button>
      {item.status === "ACTIVE" ? (
        <button
          type="button"
          onClick={() => onArchive(item.id)}
          aria-label={`Archive ${item.title || "conversation"}`}
          className="rounded-lg p-1.5 text-ink-faint opacity-70 transition-opacity hover:bg-white/5 hover:text-ink group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac"
        >
          <Archive className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
