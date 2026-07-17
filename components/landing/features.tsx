"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Brain,
  GitBranch,
  FolderKanban,
  Languages,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { GlassCard } from "@/components/ui/glass-card";
import { FEATURES } from "@/lib/constants";

const ICONS: Record<string, LucideIcon> = {
  generation: Sparkles,
  memory: Brain,
  plot: GitBranch,
  management: FolderKanban,
  language: Languages,
  editable: PenLine,
};

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <Container>
        <div className="max-w-2xl">
          <SectionEyebrow>What StoryVerse Does</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Everything a long-running story needs to stay coherent
          </h2>
          <p className="mt-4 text-ink-dim">
            Most AI writing tools reset between sessions. StoryVerse is built
            around the opposite idea — the story is the state.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = ICONS[feature.id];
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              >
                <GlassCard hover className="h-full p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                    {feature.description}
                  </p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
