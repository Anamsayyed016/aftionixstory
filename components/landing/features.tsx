"use client";

import Link from "next/link";
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
  shopfront: Building2,
  gigs: Briefcase,
  freelancer: Briefcase,
  connect: Briefcase,
};

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <Container>
        <div className="max-w-2xl">
          <SectionEyebrow>What you can do</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Stories, answers, businesses, and gigs
          </h2>
          <p className="mt-4 text-ink-dim">
            Story Studio, the universal assistant, Business Directory, and
            Freelancer Connect — connect-only for gigs (no payments in v1).
          </p>
        </div>

        <div className="mt-16 space-y-20">
          {FEATURE_GROUPS.map((group) => {
            const comingSoon = (group.status as string) === "coming_soon";
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
                    const href =
                      "href" in feature
                        ? (feature.href as string | undefined)
                        : undefined;
                    const card = (
                      <GlassCard
                        hover={!comingSoon}
                        className={cn(
                          "h-full p-6",
                          comingSoon && "opacity-80",
                          href && "transition-colors group-hover:border-violet-soft/50"
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
                        ) : href ? (
                          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-violet-soft">
                            Open →
                          </p>
                        ) : null}
                      </GlassCard>
                    );

                    return (
                      <motion.div
                        key={feature.id}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ duration: 0.5, delay: i * 0.06 }}
                        className={href ? "group" : undefined}
                      >
                        {href && !comingSoon ? (
                          <Link href={href} className="block h-full">
                            {card}
                          </Link>
                        ) : (
                          card
                        )}
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
