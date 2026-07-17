"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRICING_TIERS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border py-24 sm:py-32">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <SectionEyebrow className="justify-center">Pricing</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Start free. Write as much as the story needs.
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <GlassCard
                className={cn(
                  "relative flex h-full flex-col p-7",
                  tier.highlighted && "border-violet/50 shadow-[0_30px_60px_-30px_rgba(124,92,255,0.5)]"
                )}
              >
                {tier.highlighted && (
                  <Badge
                    variant="violet"
                    className="absolute -top-3 left-7 bg-charcoal"
                  >
                    Most Popular
                  </Badge>
                )}
                <p className="font-display text-lg font-semibold text-ink">
                  {tier.name}
                </p>
                <p className="mt-1 text-sm text-ink-faint">{tier.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-semibold text-ink">
                    {tier.price}
                  </span>
                  <span className="text-sm text-ink-faint">{tier.period}</span>
                </div>

                <ul className="mt-7 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-dim">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-soft" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8 w-full"
                  variant={tier.highlighted ? "primary" : "secondary"}
                >
                  {tier.cta}
                </Button>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
