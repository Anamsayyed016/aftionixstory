"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bot, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";

function MessageImage({ src, isUser }: { src: string; isUser: boolean }) {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  return (
    <div className="relative mt-2 aspect-square w-full max-w-[280px] overflow-hidden rounded-xl border border-border/60 bg-charcoal/60">
      {status === "loading" ? (
        <div className="absolute inset-0 animate-pulse bg-panel-raised/60" aria-hidden />
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-[11px] text-ink-faint">
          Image couldn’t load
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={isUser ? "Attached image" : "Generated image"}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
        className={cn(
          "h-full w-full object-contain transition-opacity duration-300",
          status === "ready" ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

type ChatMessageBubbleProps = {
  message: ChatMessage;
  onRetry?: () => void;
};

export function ChatMessageBubble({ message, onRetry }: ChatMessageBubbleProps) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";
  const isError = message.status === "error";

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
          "max-w-[min(36rem,85%)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-[0_10px_28px_-22px_rgba(16,24,40,0.16)]",
          isUser
            ? "rounded-br-md bg-gradient-to-br from-violet/90 to-lilac/80 text-white"
            : isError
              ? "rounded-bl-md border border-danger/35 bg-danger/10 text-ink"
              : "rounded-bl-md border border-border bg-panel-raised/90 text-ink"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.imageUrl ? (
          <MessageImage src={message.imageUrl} isUser={isUser} />
        ) : null}
        {message.status === "sending" ? (
          <p className="mt-1 text-[11px] text-ink-faint">Sending…</p>
        ) : null}
        {isError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-danger">Couldn’t finish that reply</p>
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 rounded-lg px-2.5 text-xs"
                onClick={onRetry}
              >
                Retry
              </Button>
            ) : null}
          </div>
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
