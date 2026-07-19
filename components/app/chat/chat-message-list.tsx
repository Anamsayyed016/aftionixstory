"use client";

import { useEffect, useRef } from "react";

import { ChatEmptyState } from "@/components/app/chat/chat-empty-state";
import { ChatMessageBubble } from "@/components/app/chat/chat-message-bubble";
import { ChatTypingIndicator } from "@/components/app/chat/chat-typing-indicator";
import type { ChatMessage, ChatSuggestion } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

type ChatMessageListProps = {
  messages: ChatMessage[];
  emptyTitle: string;
  emptyDescription: string;
  suggestions: ChatSuggestion[];
  onSelectSuggestion: (suggestion: ChatSuggestion) => void;
  disabled?: boolean;
  busy?: boolean;
  onRetryError?: () => void;
  className?: string;
};

export function ChatMessageList({
  messages,
  emptyTitle,
  emptyDescription,
  suggestions,
  onSelectSuggestion,
  disabled = false,
  busy = false,
  onRetryError,
  className,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  if (messages.length === 0 && !busy) {
    return (
      <ChatEmptyState
        title={emptyTitle}
        description={emptyDescription}
        suggestions={suggestions}
        onSelectSuggestion={onSelectSuggestion}
        disabled={disabled}
      />
    );
  }

  const lastErrorId =
    [...messages].reverse().find((m) => m.status === "error")?.id ?? null;

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5",
        className
      )}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Chat messages"
    >
      {messages.map((message) => (
        <ChatMessageBubble
          key={message.id}
          message={message}
          onRetry={
            message.id === lastErrorId && message.status === "error"
              ? onRetryError
              : undefined
          }
        />
      ))}
      {busy ? <ChatTypingIndicator /> : null}
      <div ref={endRef} />
    </div>
  );
}
