"use client";

import { History } from "lucide-react";

import {
  ConversationHistoryItem,
  type ConversationHistoryItemData,
} from "@/components/app/chat/conversation-history-item";
import { NewConversationButton } from "@/components/app/chat/new-conversation-button";
import { cn } from "@/lib/utils";

type ConversationHistoryProps = {
  items: ConversationHistoryItemData[];
  activeId: string | null;
  loading?: boolean;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onNew: () => void;
  className?: string;
};

export function ConversationHistory({
  items,
  activeId,
  loading = false,
  onOpen,
  onArchive,
  onNew,
  className,
}: ConversationHistoryProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-charcoal/40 p-2",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 text-ink-dim">
          <History className="h-3.5 w-3.5" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-wider">
            History
          </p>
        </div>
        <NewConversationButton onClick={onNew} disabled={loading} />
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading conversations">
          <div className="h-14 animate-pulse rounded-xl bg-panel/60" />
          <div className="h-14 animate-pulse rounded-xl bg-panel/60" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-ink-dim">No conversations yet.</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <ConversationHistoryItem
                item={item}
                active={item.id === activeId}
                onOpen={onOpen}
                onArchive={onArchive}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
