"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Brain,
  Languages,
  PenLine,
  MessageCircle,
  Code2,
  Globe2,
  ImagePlus,
  Building2,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { FEATURE_GROUPS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  generation: Sparkles,
  memory: Brain,
  language: Languages,
  editable: PenLine,
  chat: MessageCircle,
  coding: Code2,
  current: Globe2,
  images: ImagePlus,
  directory: Building2,
  jobs: Briefcase,
};

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <Container>
        <div className="max-w-2xl">
          <SectionEyebrow>What you can do</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Live today — and honest about what&apos;s next
          </h2>
          <p className="mt-4 text-ink-dim">
            Story Studio and the universal assistant are available now. Business
            Directory and Jobs are coming soon — no trial links, no fake demos.
          </p>
        </div>

        <div className="mt-16 space-y-20">
          {FEATURE_GROUPS.map((group) => {
            const comingSoon = group.status === "coming_soon";
            return (
              <div key={group.id} id={group.id}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <SectionEyebrow>{group.eyebrow}</SectionEyebrow>
                      {comingSoon ? (
                        <Badge variant="warning">Coming soon</Badge>
                      ) : (
                        <Badge variant="success" dot>
                          Live
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
                      {group.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-8 grid gap-5",
                    group.features.length <= 2
                      ? "sm:grid-cols-2"
                      : "sm:grid-cols-2 lg:grid-cols-4"
                  )}
                >
                  {group.features.map((feature, i) => {
                    const Icon = ICONS[feature.id] ?? Sparkles;
                    return (
                      <motion.div
                        key={feature.id}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ duration: 0.5, delay: i * 0.06 }}
                      >
                        <GlassCard
                          hover={!comingSoon}
                          className={cn(
                            "h-full p-6",
                            comingSoon && "opacity-80"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-md",
                              comingSoon
                                ? "bg-charcoal text-ink-faint"
                                : "bg-violet/12 text-violet-soft"
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <h4 className="mt-5 font-display text-lg font-semibold text-ink">
                            {feature.title}
                          </h4>
                          <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                            {feature.description}
                          </p>
                          {comingSoon ? (
                            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-warning">
                              Coming soon · not available yet
                            </p>
                          ) : null}
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
