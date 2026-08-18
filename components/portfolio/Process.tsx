"use client";

import { motion } from "framer-motion";

import { PROCESS } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, stagger } from "@/animations/portfolio/variants";

export function Process() {
  return (
    <section id="process" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Process
          </motion.p>
          <motion.h2 variants={fadeUp} className="pf-title mt-4 max-w-xl">
            How the work moves.
          </motion.h2>
        </motion.div>

        <ol className="mt-14 grid gap-0 border-t border-[var(--portfolio-line)] lg:grid-cols-4 lg:border-t-0">
          {PROCESS.map((step) => (
            <motion.li
              key={step.index}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
              className="border-[var(--portfolio-line)] py-8 lg:border-t lg:pr-8 lg:pt-8"
            >
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[var(--portfolio-accent)]">
                {step.index} {step.title}
              </p>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--portfolio-muted)]">
                {step.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
