"use client";

import { motion } from "framer-motion";

import { HERO, PERSON } from "@/constants/portfolio/content";
import { fadeUp, stagger, textReveal } from "@/animations/portfolio/variants";
import { HeroScene } from "@/components/portfolio/3d/HeroScene";

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden pb-16 pt-28 sm:pt-32">
      <HeroScene />
      <div
        className="pointer-events-none absolute inset-0 -z-[5]"
        style={{
          background:
            "linear-gradient(90deg, rgba(7,7,12,0.96) 0%, rgba(7,7,12,0.78) 42%, rgba(7,7,12,0.18) 100%)",
        }}
      />

      <div className="pf-wrap relative flex min-h-[calc(100svh-8rem)] flex-col justify-between">
        <motion.div
          variants={stagger(0.1, 0.08)}
          initial="hidden"
          animate="visible"
          className="max-w-2xl pt-6 lg:pt-10"
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            {PERSON.name}
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-[var(--portfolio-muted)]"
          >
            {HERO.kicker}
            <span className="mx-2 text-[var(--portfolio-faint)]">·</span>
            {PERSON.positioning}
          </motion.p>
          <motion.h1 variants={textReveal} className="pf-title mt-7">
            {HERO.headline[0]}
            <br />
            {HERO.headline[1]}
          </motion.h1>
          <motion.p variants={fadeUp} className="pf-lede mt-6">
            {HERO.body}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8">
            <p className="pf-status">
              <span className="pf-status-dot" aria-hidden />
              {HERO.status}
            </p>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <a href="#work" className="pf-cta pf-cta-primary">
              View my work
              <span className="pf-arrow" aria-hidden>
                →
              </span>
            </a>
            <a href="#contact" className="pf-cta pf-cta-ghost">
              Let&apos;s connect
              <span className="pf-arrow" aria-hidden>
                →
              </span>
            </a>
          </motion.div>
        </motion.div>

        <div className="mt-16 flex flex-col gap-8 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10">
            {HERO.meta.map((item) => (
              <li
                key={item}
                className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--portfolio-faint)]"
              >
                {item}
              </li>
            ))}
          </ul>
          <a href="#about" className="pf-scroll w-fit" aria-label="Scroll to about">
            <span>Scroll</span>
            <span className="pf-scroll-line" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
