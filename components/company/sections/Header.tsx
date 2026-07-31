"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/company/ui/Container";
import { Button } from "@/components/company/ui/Button";
import { NAV_LINKS } from "@/constants/company/site";
import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/lib/utils";

export function Header() {
  const scrolled = useScrolled(12);
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <Container>
        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-[var(--radius-lg)] px-4 py-2.5 transition-all duration-300",
            scrolled || open
              ? "glass-panel shadow-[var(--shadow-soft)]"
              : "border border-transparent bg-transparent"
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink"
            onClick={() => setOpen(false)}
          >
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,#2563eb,#7c3aed)] text-sm font-bold text-white">
              A
            </span>
            AFTIONIX
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas-soft hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button href="/contact" size="md" icon={ArrowUpRight}>
              Schedule Consultation
            </Button>
          </div>

          <button
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full text-ink lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden"
          >
            <Container>
              <div className="glass-panel mt-2 flex flex-col gap-1 rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-lifted)]">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-[var(--radius-sm)] px-4 py-3 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas-soft hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
                <Button href="/contact" size="md" icon={ArrowUpRight} className="mt-2 w-full">
                  Schedule Consultation
                </Button>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
