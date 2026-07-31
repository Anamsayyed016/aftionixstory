"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Briefcase,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

const PREVIEW_INTERVAL_MS = 3800;

type PreviewSlide = {
  id: string;
  label: string;
};

const SLIDES: PreviewSlide[] = [
  { id: "story", label: "Story Studio" },
  { id: "qa", label: "Ask anything" },
  { id: "soon", label: "Coming soon" },
];

function PreviewChrome({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-dim/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
      </div>
      <span className="font-mono text-[11px] text-ink-faint">{title}</span>
    </div>
  );
}

function StoryPreview() {
  return (
    <div className="sv-manuscript relative overflow-hidden rounded-xl border border-border-strong shadow-[0_40px_80px_-30px_rgba(16,24,40,0.13)]">
      <PreviewChrome title="Forbidden Hearts · Episode 14" />
      <div className="grid grid-cols-[1fr_auto] gap-4 p-6">
        <div>
          <p className="font-display text-lg italic leading-relaxed text-ink">
            &ldquo;Aap yahan?&rdquo; Anaya whispered, the photograph still
            trembling in her hand. Azar hadn&apos;t moved from the doorway —
            not since he&apos;d seen what she&apos;d found.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-dim">
            He had rehearsed this moment a hundred times. None of the versions
            began with her already knowing.
          </p>
        </div>
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
  );
}

function QaPreview() {
  return (
    <div className="sv-glass overflow-hidden rounded-xl border border-border-strong shadow-[0_40px_80px_-30px_rgba(16,24,40,0.13)]">
      <PreviewChrome title="Assistant · just now" />
      <div className="space-y-4 p-6">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-violet/12 px-4 py-2.5 text-sm text-ink">
            Why does my character keep contradicting episode 3?
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet/15 text-violet-soft">
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
          <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-panel-raised px-4 py-3 text-sm leading-relaxed text-ink-dim">
            In episode 3 she claimed she never met Azar — but episode 12 has
            them at the café. Want me to flag that as a continuity note, or
            rewrite the café scene?
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {["Flag continuity", "Rewrite scene", "Ask something else"].map(
            (chip) => (
              <span
                key={chip}
                className="rounded-full border border-border px-3 py-1 font-mono text-[10px] text-ink-faint"
              >
                {chip}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SoonPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-dashed border-border-strong bg-charcoal/40 shadow-[0_40px_80px_-30px_rgba(16,24,40,0.08)]">
      <PreviewChrome title="Platform · roadmap" />
      <div className="space-y-3 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Not available yet
        </p>
        <div className="rounded-lg border border-border bg-panel/50 px-4 py-3 opacity-70">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-ink-faint" />
            <span className="text-sm font-medium text-ink-dim">
              Business Directory
            </span>
            <Badge variant="warning" className="ml-auto text-[10px]">
              Coming soon
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            List and discover local businesses
          </p>
        </div>
        <div className="rounded-lg border border-border bg-panel/50 px-4 py-3 opacity-70">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-ink-faint" />
            <span className="text-sm font-medium text-ink-dim">Jobs</span>
            <Badge variant="warning" className="ml-auto text-[10px]">
              Coming soon
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            Roles matched with the same assistant
          </p>
        </div>
      </div>
    </div>
  );
}

function CyclingPreview() {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, PREVIEW_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const slide = SLIDES[index]!;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-center gap-2 sm:justify-start">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Show ${s.label}`}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-violet" : "w-1.5 bg-border-strong"
            }`}
          />
        ))}
      </div>

      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {slide.id === "story" ? <StoryPreview /> : null}
            {slide.id === "qa" ? <QaPreview /> : null}
            {slide.id === "soon" ? <SoonPreview /> : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {slide.id === "story" ? (
        <motion.div
          key="memory-chip"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="sv-glass absolute -right-4 -bottom-6 hidden max-w-[220px] rounded-lg p-3 sm:block"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-violet-soft">
            Memory saved
          </p>
          <p className="mt-1 text-xs leading-snug text-ink-dim">
            Anaya found the old photograph of Azar
          </p>
        </motion.div>
      ) : null}
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, rgba(14,116,144,0.10), transparent 60%), radial-gradient(45% 40% at 90% 20%, rgba(15,118,110,0.10), transparent 60%)",
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
              One assistant · Story Studio live
            </Badge>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              One assistant.{" "}
              <span className="sv-gradient-text italic">Stories</span>, answers,
              and what&apos;s next.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-dim">
              Write fiction that remembers, ask questions, get coding help —
              all in one place. Business Directory and Jobs are on the way.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up">
                <Button size="lg" className="group">
                  Get Started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="secondary">
                  See what&apos;s live
                </Button>
              </a>
            </div>

            <p className="mt-8 text-sm text-ink-faint">
              Free to start · No credit card · Directory &amp; Jobs coming soon
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="relative"
          >
            <CyclingPreview />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
