"use client";

import { motion } from "framer-motion";

import { SERVICES } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/portfolio/variants";

export function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Services
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="pf-display mt-4 max-w-xl text-4xl font-semibold sm:text-5xl"
          >
            What I take on.
          </motion.h2>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.07)}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SERVICES.map((service, i) => (
            <motion.li key={service.id} variants={fadeUp} className="pf-panel p-6 sm:p-7">
              <p className="pf-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--pf-ink-faint)]">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="pf-display mt-4 text-xl font-semibold">{service.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--pf-ink-dim)]">{service.body}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
