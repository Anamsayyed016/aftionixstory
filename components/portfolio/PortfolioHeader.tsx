"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

import { NAV, PERSON } from "@/constants/portfolio/content";
import { EASE } from "@/animations/portfolio/variants";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/useScrolled";

export function PortfolioHeader() {
  const scrolled = useScrolled(16);
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="pf-wrap">
        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300",
            scrolled || open ? "pf-glass shadow-[0_18px_50px_-28px_rgba(0,0,0,0.7)]" : "bg-transparent"
          )}
        >
          <Link
            href="/portfolio"
            className="pf-display text-[0.95rem] font-semibold tracking-tight text-[var(--pf-ink)]"
            onClick={() => setOpen(false)}
          >
            {PERSON.name}
            <span className="ml-2 hidden text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[var(--pf-ink-faint)] sm:inline">
              {PERSON.studio}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="pf-link rounded-full px-3 py-2 text-sm">
                {item.label}
              </a>
            ))}
          </nav>

          <a href="#contact" className="pf-cta pf-cta-primary hidden h-10 px-4 text-sm lg:inline-flex">
            Let&apos;s talk
          </a>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full text-[var(--pf-ink)] lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="lg:hidden"
          >
            <div className="pf-wrap">
              <div className="pf-glass mt-2 flex flex-col gap-1 rounded-2xl p-4">
                {NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm text-[var(--pf-ink-dim)]"
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="#contact"
                  onClick={() => setOpen(false)}
                  className="pf-cta pf-cta-primary mt-2 w-full"
                >
                  Let&apos;s talk
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
