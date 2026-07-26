"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Paperclip, SendHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CHAT_MAX_CHARS } from "@/lib/chat/constants";
import { shouldSendOnKeyDown } from "@/lib/chat/utils";
import { cn } from "@/lib/utils";

/** ~8–10 lines at text-sm / leading-relaxed */
const TEXTAREA_MAX_PX = 208;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  /** imageUrl is set when the user attached an image via the "+" button. */
  onSend: (imageUrl?: string) => void;
  placeholder: string;
  disabled?: boolean;
  busy?: boolean;
  /** Shows the "+" attach button. Off by default — opt in per surface. */
  allowAttachments?: boolean;
};

export const ChatComposer = forwardRef<HTMLTextAreaElement, ChatComposerProps>(
  function ChatComposer(
    {
      value,
      onChange,
      onSend,
      placeholder,
      disabled = false,
      busy = false,
      allowAttachments = false,
    },
    forwardedRef
  ) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    useImperativeHandle(
      forwardedRef,
      () => textareaRef.current as HTMLTextAreaElement,
      []
    );
    const labelId = useId();
    const countId = useId();
    const [pendingImage, setPendingImage] = useState<{
      url: string;
      name: string;
    } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const length = value.length;
    const nearLimit = length > CHAT_MAX_CHARS * 0.9;
    const canSend =
      !busy &&
      !disabled &&
      !uploading &&
      length <= CHAT_MAX_CHARS &&
      (value.trim().length > 0 || Boolean(pendingImage));

    const resize = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "0px";
      el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_PX)}px`;
    }, []);

    useEffect(() => {
      resize();
    }, [value, resize]);

    function handleSendClick() {
      if (!canSend) return;
      onSend(pendingImage?.url);
      setPendingImage(null);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (!shouldSendOnKeyDown(event)) return;
      event.preventDefault();
      handleSendClick();
    }

    async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setUploadError(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });
        const data = (await res.json()) as { imageUrl?: string; error?: string };
        if (!res.ok || !data.imageUrl) {
          setUploadError(data.error || "Couldn't upload that image.");
          return;
        }
        setPendingImage({ url: data.imageUrl, name: file.name });
      } catch {
        setUploadError("Couldn't upload that image. Please try again.");
      } finally {
        setUploading(false);
      }
    }

    return (
      <div className="bg-panel/80 p-3 backdrop-blur-md sm:p-4">
        <label htmlFor={labelId} className="sr-only">
          Message
        </label>
        <div className="rounded-2xl border border-border bg-charcoal/70 p-2 shadow-[0_16px_40px_-28px_rgba(16,24,40,0.16)] focus-within:border-violet-soft/60 focus-within:ring-2 focus-within:ring-lilac/25">
          {pendingImage ? (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/60 bg-panel-raised/60 p-1.5 pr-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.url}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-dim">
                {pendingImage.name}
              </span>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                aria-label="Remove attached image"
                className="rounded-md p-1 text-ink-faint hover:bg-charcoal hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          {uploadError ? (
            <p className="mb-2 text-[11px] text-danger">{uploadError}</p>
          ) : null}
          <div className="flex items-end gap-2">
            {allowAttachments ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={disabled || busy || uploading}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="mb-0.5 shrink-0 rounded-xl"
                  disabled={disabled || busy || uploading}
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach an image"
                >
                  {!uploading ? <Paperclip className="h-4 w-4" aria-hidden /> : null}
                </Button>
              </>
            ) : null}
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
              className="max-h-[13rem] min-h-[44px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2.5 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
            />
            <Button
              type="button"
              size="sm"
              className="mb-0.5 shrink-0 rounded-xl"
              disabled={!canSend}
              loading={busy}
              onClick={handleSendClick}
              aria-label="Send message"
            >
              {!busy ? <SendHorizontal className="h-4 w-4" aria-hidden /> : null}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 px-1 pb-0.5 pt-1">
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
            <p className="text-[10px] text-ink-faint sm:text-[11px]">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      </div>
    );
  }
);
ChatComposer.displayName = "ChatComposer";
