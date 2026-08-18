"use client";

import { motion } from "framer-motion";

import { PERSON } from "@/constants/portfolio/content";
import { fadeUp, revealViewport, stagger, textReveal } from "@/animations/portfolio/variants";

export function Contact() {
  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.1)}
          className="max-w-4xl"
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Have an idea?
          </motion.p>
          <motion.h2 variants={textReveal} className="pf-title mt-5">
            Let&apos;s build something
            <br />
            worth remembering.
          </motion.h2>
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-3">
            <a href={`mailto:${PERSON.email}`} className="pf-cta pf-cta-primary">
              Start a project
              <span className="pf-arrow" aria-hidden>
                →
              </span>
            </a>
            <a
              href={PERSON.socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="pf-cta pf-cta-ghost"
            >
              LinkedIn
              <span className="pf-arrow" aria-hidden>
                →
              </span>
            </a>
            <a
              href={PERSON.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="pf-cta pf-cta-ghost"
            >
              GitHub
              <span className="pf-arrow" aria-hidden>
                →
              </span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
