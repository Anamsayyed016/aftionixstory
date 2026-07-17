"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { GlassCard } from "@/components/ui/glass-card";
import { TESTIMONIALS } from "@/lib/constants";

export function Testimonials() {
  return (
    <section className="border-t border-border py-24 sm:py-32">
      <Container>
        <div className="max-w-xl">
          <SectionEyebrow>From Writers</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Stories that don&apos;t lose the thread
          </h2>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <GlassCard className="flex h-full flex-col p-6">
                <Quote className="h-5 w-5 text-violet-soft/60" />
                <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-dim">
                  {t.quote}
                </p>
                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-sm font-medium text-ink">{t.name}</p>
                  <p className="text-xs text-ink-faint">{t.role}</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
