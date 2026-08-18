"use client";

import { motion } from "framer-motion";

import { SKILL_GROUPS } from "@/constants/portfolio/skills";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/portfolio/variants";
import { SpinCube } from "@/components/portfolio/3d/SpinCube";

export function TechStack() {
  return (
    <section id="stack" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.08)}
          className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <motion.p variants={fadeUp} className="pf-kicker">
              Stack
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="pf-display mt-4 max-w-lg text-4xl font-semibold sm:text-5xl"
            >
              Tools I actually ship with.
            </motion.h2>
          </div>
          <motion.div variants={fadeUp} className="hidden origin-center lg:block">
            <SpinCube />
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.08)}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{ perspective: "900px" }}
        >
          {SKILL_GROUPS.map((group) => (
            <motion.article
              key={group.id}
              variants={fadeUp}
              className="pf-panel p-6 transition-transform duration-500 hover:-translate-y-1"
            >
              <h3 className="pf-mono text-[0.68rem] uppercase tracking-[0.2em] text-[var(--pf-accent)]">
                {group.label}
              </h3>
              <ul className="mt-5 space-y-2.5">
                {group.items.map((item) => (
                  <li key={item} className="text-sm text-[var(--pf-ink)]">
                    {item}
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
