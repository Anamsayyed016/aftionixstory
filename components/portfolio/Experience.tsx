"use client";

import { motion } from "framer-motion";

import { JOURNEY } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, stagger } from "@/animations/portfolio/variants";

export function Experience() {
  return (
    <section id="experience" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Experience
          </motion.p>
          <motion.h2 variants={fadeUp} className="pf-title mt-4 max-w-xl">
            The journey.
          </motion.h2>
        </motion.div>

        <ol className="mt-14">
          {JOURNEY.map((item, i) => (
            <motion.li
              key={item.id}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={fadeUp}
              className="grid gap-4 border-t border-[var(--portfolio-line)] py-9 sm:grid-cols-[7rem_1fr] sm:gap-10"
            >
              <p className="font-mono text-sm text-[var(--portfolio-faint)]">
                {String(i + 1).padStart(2, "0")}
              </p>
              <div>
                <h3 className="pf-display text-2xl font-semibold sm:text-3xl">{item.title}</h3>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--portfolio-muted)] sm:text-base">
                  {item.body}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
