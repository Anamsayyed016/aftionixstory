"use client";

import * as React from "react";
import { Check, ClipboardCopy, ExternalLink, MapPin } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import {
  formatBusinessDetailsForClipboard,
  GOOGLE_BUSINESS_PROFILE_CREATE_URL,
  gbpNudgeStorageKey,
  type BusinessDetailsForGbp,
} from "@/lib/marketplace/google-business-profile";

type Props = {
  businessId: string;
  business: BusinessDetailsForGbp;
};

function readDismissed(businessId: string): boolean {
  try {
    return window.localStorage.getItem(gbpNudgeStorageKey(businessId)) === "1";
  } catch {
    return false;
  }
}

export function GoogleBusinessProfileNudge({ businessId, business }: Props) {
  const [tick, setTick] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  const dismissed = React.useSyncExternalStore(
    React.useCallback(
      (onStoreChange) => {
        const key = gbpNudgeStorageKey(businessId);
        const onStorage = (event: StorageEvent) => {
          if (event.key === key || event.key === null) onStoreChange();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
      },
      [businessId]
    ),
    () => {
      void tick;
      return readDismissed(businessId);
    },
    () => false
  );

  if (dismissed) return null;

  const details = formatBusinessDetailsForClipboard(business);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(gbpNudgeStorageKey(businessId), "1");
    } catch {
      /* ignore quota / private mode */
    }
    setTick((n) => n + 1);
  }

  return (
    <GlassCard
      className="mt-8 border-violet/25 bg-violet/5 p-5 sm:p-6"
      data-testid="gbp-nudge-card"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">
            You&apos;re listed here — want to also show up on Google Maps?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">
            It takes about 5 minutes. We&apos;ll help you copy what you already
            entered; Google&apos;s signup is separate (we don&apos;t create the
            Maps listing for you).
          </p>

          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-ink-dim">
            <li>Copy your business details below</li>
            <li>Open Google Business Profile&apos;s signup page</li>
            <li>Paste the details and finish Google&apos;s own verification</li>
          </ol>

          <pre
            className="mt-4 overflow-x-auto rounded-md border border-border bg-panel px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-dim whitespace-pre-wrap"
            data-testid="gbp-details-block"
          >
            {details}
          </pre>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void copyDetails()}
              data-testid="gbp-copy-details"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copy my business details
                </>
              )}
            </Button>
            <a
              href={GOOGLE_BUSINESS_PROFILE_CREATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Open Google Business Profile
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
