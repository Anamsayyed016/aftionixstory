"use client";

import { useEffect, useRef } from "react";

import { ChatEmptyState } from "@/components/app/chat/chat-empty-state";
import { ChatMessageBubble } from "@/components/app/chat/chat-message-bubble";
import type { ChatMessage, ChatSuggestion } from "@/lib/chat/types";

type ChatMessageListProps = {
  messages: ChatMessage[];
  emptyTitle: string;
  emptyDescription: string;
  suggestions: ChatSuggestion[];
  onSelectSuggestion: (suggestion: ChatSuggestion) => void;
  disabled?: boolean;
};

export function ChatMessageList({
  messages,
  emptyTitle,
  emptyDescription,
  suggestions,
  onSelectSuggestion,
  disabled = false,
}: ChatMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (messages.length === 0) {
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

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-4"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Chat messages"
    >
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
