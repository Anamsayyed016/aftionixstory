"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/company/ui/Container";
import { SectionEyebrow } from "@/components/company/ui/SectionEyebrow";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/company/variants";
import { WHY_CHOOSE_US } from "@/constants/company/whyChooseUs";

export function WhyChooseUs() {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>why aftionix</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            The details clients notice after launch.
          </h2>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.05)}
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {WHY_CHOOSE_US.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="rounded-[var(--radius-lg)] border border-border bg-canvas-soft/50 p-5 transition-colors hover:border-primary/30 hover:bg-white"
              >
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 font-display text-sm font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}
