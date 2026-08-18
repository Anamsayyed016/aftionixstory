"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { PERSON } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/portfolio/variants";

export function Contact() {
  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.1)}
          className="pf-panel relative overflow-hidden px-6 py-14 sm:px-12 sm:py-20"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40"
            style={{
              background: "radial-gradient(circle, var(--pf-glow), transparent 68%)",
            }}
          />
          <motion.p variants={fadeUp} className="pf-kicker">
            Contact
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="pf-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl"
          >
            If the work should exist, let&apos;s make it real.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-lg text-base text-[var(--pf-ink-dim)]"
          >
            New products, AI systems, or a platform that needs to last. I usually reply within
            a business day.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-3">
            <a href={`mailto:${PERSON.email}`} className="pf-cta pf-cta-primary">
              {PERSON.email}
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href={PERSON.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="pf-cta pf-cta-ghost"
            >
              WhatsApp
              <ArrowUpRight className="size-4" />
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
