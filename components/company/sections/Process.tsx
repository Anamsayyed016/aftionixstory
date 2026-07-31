"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/company/ui/Container";
import { SectionEyebrow } from "@/components/company/ui/SectionEyebrow";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/company/variants";
import { PROCESS_STEPS } from "@/constants/company/process";
import { cn } from "@/lib/utils";

export function Process() {
  const [active, setActive] = useState(0);

  return (
    <section id="process" className="bg-canvas-deep py-24 text-ink-invert sm:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="text-accent">process</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Eight steps. Zero guesswork.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/60">
            The same disciplined process behind every AFTIONIX engagement,
            from a landing page to a multi-tenant SaaS platform.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.04)}
          className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8"
        >
          {PROCESS_STEPS.map((step, i) => (
            <motion.button
              key={step.index}
              variants={fadeUp}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-[var(--radius-md)] border p-4 text-left transition-all duration-300",
                active === i
                  ? "border-transparent bg-[linear-gradient(135deg,var(--co-primary),var(--co-accent))] shadow-[var(--shadow-glow-accent)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              )}
            >
              <span className="font-mono text-xs text-white/40">{step.index}</span>
              <p
                className={cn(
                  "mt-2 font-display text-sm font-semibold",
                  active === i ? "text-white" : "text-white/80"
                )}
              >
                {step.title}
              </p>
            </motion.button>
          ))}
        </motion.div>

        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto mt-8 max-w-xl rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.03] p-6 text-center"
        >
          <p className="font-mono text-xs text-accent">{PROCESS_STEPS[active].index}</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-white">
            {PROCESS_STEPS[active].title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {PROCESS_STEPS[active].description}
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
