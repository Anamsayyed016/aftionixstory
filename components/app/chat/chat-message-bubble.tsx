"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bot, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";

type ChatMessageBubbleProps = {
  message: ChatMessage;
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser ? (
        <span
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-panel-raised text-lilac"
          aria-hidden
        >
          <Bot className="h-3.5 w-3.5" />
        </span>
      ) : null}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_10px_28px_-22px_rgba(0,0,0,0.8)]",
          isUser
            ? "rounded-br-md bg-gradient-to-br from-violet/90 to-lilac/80 text-white"
            : "rounded-bl-md border border-border bg-panel-raised/90 text-ink"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.status === "sending" ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Sending…
          </p>
        ) : null}
        {message.status === "error" ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-danger">
            Failed
          </p>
        ) : null}
      </div>

      {isUser ? (
        <span
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-charcoal text-ink-dim"
          aria-hidden
        >
          <UserRound className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </motion.div>
  );
}
