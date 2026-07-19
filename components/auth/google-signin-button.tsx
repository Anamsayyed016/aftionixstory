"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  onError?: (message: string) => void;
  className?: string;
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  callbackUrl = "/dashboard",
  onError,
  className,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = loading || pending;

  function handleClick() {
    if (busy) return;

    setLoading(true);
    startTransition(() => {
      void (async () => {
        try {
          await signIn("google", {
            callbackUrl,
          });
        } catch {
          setLoading(false);
          onError?.("Unable to continue with Google. Please try again.");
        }
      })();
    });
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label="Continue with Google"
      aria-busy={busy}
      whileHover={busy ? undefined : { y: -1, scale: 1.01 }}
      whileTap={busy ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-border-strong bg-white text-sm font-semibold text-[#1f1f1f] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)] transition-[border-color,box-shadow,background-color] duration-200",
        "hover:border-violet-soft/50 hover:shadow-[0_16px_40px_-18px_rgba(124,92,255,0.45)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
        "disabled:pointer-events-none disabled:opacity-60",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet/0 via-violet/5 to-lilac/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#5f6368]" aria-hidden />
      ) : (
        <GoogleMark className="h-5 w-5 shrink-0" />
      )}
      <span>{busy ? "Connecting…" : "Continue with Google"}</span>
    </motion.button>
  );
}
