"use client";

import { motion } from "framer-motion";

import { PERSON, PRINCIPLES } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/portfolio/variants";

export function About() {
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="pf-wrap grid gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.1)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            About
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="pf-display mt-4 max-w-xl text-4xl font-semibold leading-[1.05] text-[var(--pf-ink)] sm:text-5xl"
          >
            Building products people can live in — not demos.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base leading-relaxed text-[var(--pf-ink-dim)] sm:text-lg"
          >
            {PERSON.summary}
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mt-4 max-w-xl text-base leading-relaxed text-[var(--pf-ink-dim)]"
          >
            {PERSON.experience} in production work. I stay close to the stack: interfaces,
            APIs, data, AI providers, and the deploy path that has to work on Monday morning.
          </motion.p>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.12)}
          className="grid gap-4 self-center"
        >
          {PRINCIPLES.map((item, i) => (
            <motion.li key={item.title} variants={fadeUp} className="pf-panel p-6">
              <p className="pf-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--pf-ink-faint)]">
                0{i + 1}
              </p>
              <h3 className="pf-display mt-3 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--pf-ink-dim)]">{item.body}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
