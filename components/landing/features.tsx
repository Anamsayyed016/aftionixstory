"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  MessageCircle,
  Building2,
  Briefcase,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { STUDIO_PRODUCT_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "story-studio": Sparkles,
  assistant: MessageCircle,
  "business-directory": Building2,
  "freelancer-connect": Briefcase,
};

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>What you can do</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            One assistant, four things you can do
          </h2>
          <p className="mt-4 text-ink-dim">
            Pick a starting point — same chat either way. No jargon wall, no
            nested feature grids.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {STUDIO_PRODUCT_CARDS.map((product, i) => {
            const Icon = ICONS[product.id] ?? Sparkles;
            const live = product.status === "live";
            return (
              <motion.div
                key={product.id}
                id={product.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <GlassCard hover className="flex h-full flex-col p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
                      <Icon className="h-5 w-5" />
                    </span>
                    {live ? (
                      <Badge variant="success" dot>
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="warning">Coming soon</Badge>
                    )}
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-ink">
                    {product.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-dim">
                    {product.benefit}
                  </p>
                  <Link
                    href={product.href}
                    className={cn(
                      "mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-lilac transition-colors hover:underline"
                    )}
                  >
                    {product.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
