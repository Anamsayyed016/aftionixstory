"use client";

import { motion } from "framer-motion";

import { SERVICES } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, stagger } from "@/animations/portfolio/variants";

export function Services() {
  return (
    <section id="services" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Services
          </motion.p>
          <motion.h2 variants={fadeUp} className="pf-title mt-4 max-w-xl">
            What I can build.
          </motion.h2>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.08)}
          className="mt-14 grid gap-4 sm:grid-cols-2"
        >
          {SERVICES.map((service) => (
            <motion.li
              key={service.id}
              variants={fadeUp}
              className="pf-panel group p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-8"
            >
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[var(--portfolio-faint)]">
                {service.index}
              </p>
              <h3 className="pf-display mt-5 text-2xl font-semibold">{service.title}</h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--portfolio-muted)]">
                {service.body}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
