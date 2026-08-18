"use client";

import { useId, useState } from "react";
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
  const menuId = useId();

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="pf-wrap">
        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-2xl px-3 py-2 transition-all duration-300 sm:px-4",
            scrolled || open ? "pf-glass" : "bg-transparent"
          )}
        >
          <Link
            href="/portfolio"
            className="pf-display leading-[1.05] text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--portfolio-text)]"
            onClick={() => setOpen(false)}
          >
            <span className="block">{PERSON.firstName}</span>
            <span className="block text-[var(--portfolio-muted)]">{PERSON.lastName}</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Portfolio">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="pf-link rounded-full px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.16em]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a href="#contact" className="pf-cta pf-cta-primary hidden h-10 px-4 lg:inline-flex">
            Let&apos;s talk
            <span className="pf-arrow" aria-hidden>
              →
            </span>
          </a>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-full text-[var(--portfolio-text)] lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="lg:hidden"
          >
            <div className="pf-wrap">
              <nav
                aria-label="Mobile"
                className="pf-glass mt-2 flex flex-col gap-1 rounded-2xl p-3"
              >
                {NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3.5 font-mono text-sm uppercase tracking-[0.16em] text-[var(--portfolio-muted)]"
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
                  <span className="pf-arrow" aria-hidden>
                    →
                  </span>
                </a>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
