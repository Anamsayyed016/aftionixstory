"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/company/ui/Container";
import { SectionEyebrow } from "@/components/company/ui/SectionEyebrow";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/company/variants";
import { TECHNOLOGIES } from "@/constants/company/technologies";

export function Technologies() {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>technologies</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            A modern, production-proven stack.
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {TECHNOLOGIES.map((group) => (
            <motion.div
              key={group.category}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
              variants={staggerContainer(0.03)}
            >
              <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-ink-faint">
                {group.category}
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((tech) => (
                  <motion.span
                    key={tech}
                    variants={fadeUp}
                    className="cursor-default rounded-full border border-border-strong px-3.5 py-1.5 text-sm text-ink-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-[var(--shadow-soft)]"
                  >
                    {tech}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
