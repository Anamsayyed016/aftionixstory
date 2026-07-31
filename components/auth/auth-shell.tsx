"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { SITE } from "@/lib/constants";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-void">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 40% at 20% 0%, rgba(14,116,144,0.10), transparent 55%), radial-gradient(40% 35% at 90% 10%, rgba(15,118,110,0.08), transparent 50%)",
        }}
      />

      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aftionix-logo.jpg"
              alt="AFTIONIX"
              className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-border"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              {SITE.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border border-border/80 bg-panel/70 p-6 shadow-[0_28px_80px_-40px_rgba(16,24,40,0.18),0_0_0_1px_rgba(14,116,144,0.06)] backdrop-blur-xl sm:p-8">
            <div className="mb-7 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/aftionix-logo.jpg"
                alt=""
                className="mx-auto mb-4 h-12 w-12 rounded-2xl object-cover ring-1 ring-border shadow-[0_12px_30px_-12px_rgba(14,116,144,0.20)]"
              />
              <span className="sr-only">{SITE.name}</span>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
