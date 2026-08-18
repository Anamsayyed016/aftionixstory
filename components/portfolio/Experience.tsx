"use client";

import { motion } from "framer-motion";

import { EXPERIENCE } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/portfolio/variants";

export function Experience() {
  return (
    <section id="experience" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Experience
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="pf-display mt-4 max-w-xl text-4xl font-semibold sm:text-5xl"
          >
            A short path. A lot of shipped surface.
          </motion.h2>
        </motion.div>

        <ol className="mt-14 space-y-0">
          {EXPERIENCE.map((item, i) => (
            <motion.li
              key={item.title}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
              className="grid gap-6 border-t border-[var(--pf-line)] py-10 lg:grid-cols-[14rem_1fr]"
            >
              <p className="pf-mono text-sm text-[var(--pf-ink-faint)]">{item.period}</p>
              <div>
                <h3 className="pf-display text-2xl font-semibold">
                  {item.title}
                  <span className="text-[var(--pf-ink-dim)]"> · {item.org}</span>
                </h3>
                <p className="mt-1 text-sm text-[var(--pf-ink-faint)]">{item.location}</p>
                <ul className="mt-5 space-y-2.5">
                  {item.points.map((point) => (
                    <li
                      key={point}
                      className="max-w-2xl text-sm leading-relaxed text-[var(--pf-ink-dim)]"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <span className="sr-only">Role {i + 1}</span>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
