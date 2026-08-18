"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { PERSON, STATS } from "@/constants/portfolio/content";
import { fadeUp, staggerContainer } from "@/animations/portfolio/variants";
import { HeroScene } from "@/components/portfolio/3d/HeroScene";

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden pb-20 pt-32 sm:pt-40">
      <HeroScene />
      <div
        className="pointer-events-none absolute inset-0 -z-[5]"
        style={{
          background:
            "linear-gradient(90deg, rgba(5,7,11,0.92) 0%, rgba(5,7,11,0.55) 48%, rgba(5,7,11,0.22) 100%)",
        }}
      />

      <div className="pf-wrap relative">
        <motion.div
          variants={staggerContainer(0.1, 0.05)}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            {PERSON.role} · {PERSON.location}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="pf-display mt-6 text-5xl font-semibold leading-[0.95] text-[var(--pf-ink)] sm:text-6xl lg:text-[5.25rem]"
          >
            {PERSON.name.split(" ")[0]}
            <br />
            <span className="pf-gradient-text">{PERSON.name.split(" ").slice(1).join(" ")}</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-7 max-w-xl text-lg leading-relaxed text-[var(--pf-ink-dim)] sm:text-xl"
          >
            {PERSON.tagline}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-3">
            <a href="#work" className="pf-cta pf-cta-primary">
              View selected work
              <ArrowDownRight className="size-4" />
            </a>
            <a href={`mailto:${PERSON.email}`} className="pf-cta pf-cta-ghost">
              {PERSON.email}
              <ArrowUpRight className="size-4" />
            </a>
          </motion.div>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7 }}
          className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--pf-line)] bg-[var(--pf-line)] sm:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-[var(--pf-bg)] px-5 py-5 sm:px-6">
              <dt className="pf-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--pf-ink-faint)]">
                {stat.label}
              </dt>
              <dd className="pf-display mt-2 text-2xl font-semibold text-[var(--pf-ink)]">
                {stat.value}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
