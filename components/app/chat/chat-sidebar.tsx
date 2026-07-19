"use client";

import { useEffect, useId, useRef } from "react";
import { History, Plus, X } from "lucide-react";

import {
  ConversationHistoryItem,
  type ConversationHistoryItemData,
} from "@/components/app/chat/conversation-history-item";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  items: ConversationHistoryItemData[];
  activeId: string | null;
  loading?: boolean;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onNew: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
};

function SidebarBody({
  items,
  activeId,
  loading,
  onOpen,
  onArchive,
  onNew,
  onItemActivate,
}: {
  items: ConversationHistoryItemData[];
  activeId: string | null;
  loading: boolean;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onNew: () => void;
  onItemActivate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 p-3">
        <Button
          type="button"
          variant="secondary"
          className="h-10 w-full justify-start rounded-xl"
          disabled={loading}
          onClick={onNew}
          aria-label="Start new story chat"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Story Chat
        </Button>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2 text-ink-faint">
        <History className="h-3.5 w-3.5" aria-hidden />
        <p className="text-xs">Recent</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div
            className="space-y-2 px-1"
            aria-busy="true"
            aria-label="Loading conversations"
          >
            <div className="h-14 animate-pulse rounded-xl bg-panel/60" />
            <div className="h-14 animate-pulse rounded-xl bg-panel/60" />
            <div className="h-14 animate-pulse rounded-xl bg-panel/60" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-4 text-xs text-ink-dim">
            No conversations yet. Start chatting to create one.
          </p>
        ) : (
          <ul className="space-y-1" role="list">
            {items.map((item) => (
              <li key={item.id}>
                <ConversationHistoryItem
                  item={item}
                  active={item.id === activeId}
                  onOpen={(id) => {
                    onOpen(id);
                    onItemActivate?.();
                  }}
                  onArchive={onArchive}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ChatSidebar({
  items,
  activeId,
  loading = false,
  onOpen,
  onArchive,
  onNew,
  mobileOpen = false,
  onMobileClose,
  className,
}: ChatSidebarProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onMobileClose?.();
    }

    document.addEventListener("keydown", onKeyDown);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <aside
        aria-label="Conversation history"
        className={cn(
          "hidden h-full w-[280px] shrink-0 flex-col border-r border-border/80 bg-charcoal/50 lg:flex",
          className
        )}
      >
        <SidebarBody
          items={items}
          activeId={activeId}
          loading={loading}
          onOpen={onOpen}
          onArchive={onArchive}
          onNew={onNew}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-void/70 backdrop-blur-sm"
            aria-label="Close conversation history"
            onClick={onMobileClose}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col border-r border-border bg-panel shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-center justify-between border-b border-border/80 px-3 py-3">
              <h2 id={titleId} className="font-display text-base font-semibold text-ink">
                Conversations
              </h2>
              <button
                type="button"
                onClick={onMobileClose}
                aria-label="Close history"
                className="rounded-lg border border-border p-2 text-ink-dim hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <SidebarBody
              items={items}
              activeId={activeId}
              loading={loading}
              onOpen={onOpen}
              onArchive={onArchive}
              onNew={() => {
                onNew();
                onMobileClose?.();
              }}
              onItemActivate={onMobileClose}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
