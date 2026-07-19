"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MessageSquareText } from "lucide-react";

import { ChatSuggestionChips } from "@/components/app/chat/chat-suggestion-chips";
import type { ChatSuggestion } from "@/lib/chat/types";

type ChatEmptyStateProps = {
  title: string;
  description: string;
  suggestions: ChatSuggestion[];
  onSelectSuggestion: (suggestion: ChatSuggestion) => void;
  disabled?: boolean;
};

export function ChatEmptyState({
  title,
  description,
  suggestions,
  onSelectSuggestion,
  disabled = false,
}: ChatEmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
      }
      className="flex h-full flex-col items-center justify-center px-4 py-10 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-panel-raised text-lilac">
        <MessageSquareText className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {description}
      </p>
      <ChatSuggestionChips
        className="mt-6 max-w-xl"
        suggestions={suggestions}
        onSelect={onSelectSuggestion}
        disabled={disabled}
      />
    </motion.div>
  );
}
