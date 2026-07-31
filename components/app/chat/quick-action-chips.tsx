"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export type QuickAction = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Prefill the composer with this text and focus it — never auto-sends. */
  prompt?: string;
  /** Navigate to an existing app route instead of prefilling. */
  href?: string;
};

export type MoreIdea = {
  id: string;
  title: string;
  prompt: string;
};

type QuickActionChipsProps = {
  actions: QuickAction[];
  onSelectPrompt: (prompt: string) => void;
  wizardHref: string;
  disabled?: boolean;
  moreIdeas?: MoreIdea[];
};

export function QuickActionChips({
  actions,
  onSelectPrompt,
  wizardHref,
  disabled = false,
  moreIdeas = [],
}: QuickActionChipsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.1 }
      }
      className="border-t border-border/50 px-3 py-3 sm:px-4"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="list" aria-label="Quick actions">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet/12 text-violet-soft ring-1 ring-violet/20">
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="mt-2 block font-display text-xs font-semibold text-ink">
                {action.title}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-dim">
                {action.description}
              </span>
            </>
          );

          const className =
            "block h-full rounded-xl border border-border bg-panel-raised/60 px-3 py-2.5 text-left transition-colors hover:border-violet-soft/45 hover:bg-panel-raised disabled:pointer-events-none disabled:opacity-50";

          if (action.href) {
            return (
              <Link key={action.id} href={action.href} role="listitem" className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              role="listitem"
              disabled={disabled}
              onClick={() => action.prompt && onSelectPrompt(action.prompt)}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {moreIdeas.length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer list-none text-xs text-ink-faint hover:text-ink-dim">
              More ideas…
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5" role="list" aria-label="More story ideas">
              {moreIdeas.map((idea) => (
                <button
                  key={idea.id}
                  type="button"
                  role="listitem"
                  disabled={disabled}
                  onClick={() => onSelectPrompt(idea.prompt)}
                  className="rounded-full border border-border bg-charcoal/50 px-3 py-1 text-xs text-ink-dim transition-colors hover:border-violet-soft/40 hover:text-ink disabled:opacity-50"
                >
                  {idea.title}
                </button>
              ))}
            </div>
          </details>
        ) : (
          <span />
        )}
        <Link
          href={wizardHref}
          className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink-dim"
        >
          Prefer a form instead?
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        <Link href="/connect/business" className="hover:text-ink-dim">
          Business form
        </Link>
        <Link href="/connect/freelancer" className="hover:text-ink-dim">
          Freelancer form
        </Link>
        <Link href="/connect/gig" className="hover:text-ink-dim">
          Gig form
        </Link>
      </div>
    </motion.div>
  );
}
