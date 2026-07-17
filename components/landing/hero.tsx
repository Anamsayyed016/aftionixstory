"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, BookMarked, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
      {/* Ambient background — lightweight, restrained */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, rgba(124,92,255,0.14), transparent 60%), radial-gradient(45% 40% at 90% 20%, rgba(232,180,200,0.10), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--sv-border-strong) 1px, transparent 1px), linear-gradient(90deg, var(--sv-border-strong) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <Container>
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Badge variant="violet" dot>
              Now writing in Hinglish & 12 other languages
            </Badge>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Your stories{" "}
              <span className="sv-gradient-text italic">remember</span>{" "}
              everything.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-dim">
              Create characters, generate episodes, and continue your story
              anytime — without re-explaining who said what, who knows what,
              or what&apos;s still unresolved. StoryVerse keeps the memory so
              you can keep writing.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up">
                <Button size="lg" className="group">
                  Start Your Story
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="secondary" className="group">
                  <Play className="h-4 w-4" />
                  View Demo
                </Button>
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-ink-faint">
              <div className="flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-violet-soft" />
                <span>40,000+ episodes generated</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-rose" />
                <span>No credit card required</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="relative"
          >
            {/* Story workspace preview — the signature manuscript card */}
            <div className="sv-manuscript relative overflow-hidden rounded-xl border border-border-strong p-1 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-dim/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>
                <span className="font-mono text-[11px] text-ink-faint">
                  Forbidden Hearts · Episode 14
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 p-6">
                <div>
                  <p className="font-display text-lg italic leading-relaxed text-ink">
                    &ldquo;Aap yahan?&rdquo; Anaya whispered, the photograph
                    still trembling in her hand. Azar hadn&apos;t moved from
                    the doorway — not since he&apos;d seen what she&apos;d
                    found.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-ink-dim">
                    He had rehearsed this moment a hundred times. None of the
                    versions began with her already knowing.
                  </p>
                </div>

                {/* memory thread rail */}
                <div className="flex w-10 flex-col items-center gap-3 border-l border-border pl-3">
                  <span className="rounded-full bg-violet/15 p-1.5">
                    <Sparkles className="h-3 w-3 text-violet-soft" />
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-rose" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-soft" />
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <div className="flex -space-x-2">
                  {["A", "S", "K"].map((initial) => (
                    <span
                      key={initial}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-panel-raised font-mono text-[10px] text-ink-dim"
                    >
                      {initial}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-[11px] text-ink-faint">
                  3 new memories · autosaved
                </span>
              </div>
            </div>

            {/* floating memory chip */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="sv-glass absolute -right-4 -bottom-6 hidden max-w-[220px] rounded-lg p-3 sm:block"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-violet-soft">
                Memory saved
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-dim">
                Anaya found the old photograph of Azar
              </p>
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
