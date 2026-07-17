"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { HOW_IT_WORKS } from "@/lib/constants";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border py-24 sm:py-32">
      <Container>
        <div className="max-w-2xl">
          <SectionEyebrow>The Process</SectionEyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            From first line to finished episode
          </h2>
        </div>

        <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="relative pl-14"
            >
              <span className="font-display absolute left-0 top-0 text-4xl font-semibold text-transparent [-webkit-text-stroke:1px_var(--sv-border-strong)]">
                {String(item.step).padStart(2, "0")}
              </span>
              <h3 className="font-display text-lg font-semibold text-ink">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
