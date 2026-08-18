"use client";

import { motion } from "framer-motion";

import { ABOUT } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, stagger } from "@/animations/portfolio/variants";

export function About() {
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="pf-wrap grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.1)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            About
          </motion.p>
          <motion.h2 variants={fadeUp} className="pf-title mt-4 max-w-lg">
            {ABOUT.heading}
          </motion.h2>
          <motion.p variants={fadeUp} className="pf-lede mt-6">
            {ABOUT.body}
          </motion.p>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.12)}
          className="grid gap-4 self-center sm:grid-cols-3 lg:grid-cols-1"
        >
          {ABOUT.stats.map((stat) => (
            <motion.li key={stat.label} variants={fadeUp} className="pf-panel px-6 py-6">
              <p className="pf-display text-4xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--portfolio-muted)]">
                {stat.label}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
