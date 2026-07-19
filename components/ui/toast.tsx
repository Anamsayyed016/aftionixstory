"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "error" | "success";

type ToastProps = {
  message: string | null;
  variant?: ToastVariant;
  onDismiss?: () => void;
};

export function Toast({
  message,
  variant = "error",
  onDismiss,
}: ToastProps) {
  const isError = variant === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role={isError ? "alert" : "status"}
          aria-live={isError ? "assertive" : "polite"}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-[0_12px_40px_-20px_rgba(0,0,0,0.7)] backdrop-blur-md",
            isError
              ? "border-danger/35 bg-danger/10 text-danger"
              : "border-success/35 bg-success/10 text-success"
          )}
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1 leading-relaxed text-ink">{message}</p>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
