"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CHAT_MAX_CHARS } from "@/lib/chat/constants";
import { canSendMessage, shouldSendOnKeyDown } from "@/lib/chat/utils";
import { cn } from "@/lib/utils";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  busy?: boolean;
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  disabled = false,
  busy = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelId = useId();
  const countId = useId();
  const canSend = canSendMessage(value, busy || disabled);
  const length = value.length;
  const nearLimit = length > CHAT_MAX_CHARS * 0.9;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSendOnKeyDown(event)) return;
    event.preventDefault();
    if (canSend) onSend();
  }

  return (
    <div className="border-t border-border/80 bg-panel/80 p-3 backdrop-blur-md sm:p-4">
      <label htmlFor={labelId} className="sr-only">
        Message
      </label>
      <div className="rounded-2xl border border-border bg-charcoal/70 p-2 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.8)] focus-within:border-violet-soft/60 focus-within:ring-2 focus-within:ring-lilac/25">
        <textarea
          id={labelId}
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || busy}
          placeholder={placeholder}
          maxLength={CHAT_MAX_CHARS}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={countId}
          aria-label="Chat message"
          className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <p
            id={countId}
            className={cn(
              "font-mono text-[10px] tracking-wider",
              nearLimit ? "text-warning" : "text-ink-faint",
              length >= CHAT_MAX_CHARS && "text-danger"
            )}
          >
            {length}/{CHAT_MAX_CHARS}
          </p>
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            disabled={!canSend}
            loading={busy}
            onClick={onSend}
            aria-label="Send message"
          >
            {!busy ? <SendHorizontal className="h-4 w-4" aria-hidden /> : null}
            Send
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
