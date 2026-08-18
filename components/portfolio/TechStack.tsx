"use client";

import { motion } from "framer-motion";

import { SKILLS } from "@/constants/portfolio/skills";
import { fadeUp, revealViewport, stagger } from "@/animations/portfolio/variants";
import { cn } from "@/lib/utils";

export function TechStack() {
  const count = SKILLS.length;

  return (
    <section id="stack" className="relative py-24 sm:py-32">
      <div className="pf-wrap">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.08)}
        >
          <motion.p variants={fadeUp} className="pf-kicker">
            Stack
          </motion.p>
          <motion.h2 variants={fadeUp} className="pf-title mt-4 max-w-xl">
            Tools I build with.
          </motion.h2>
        </motion.div>

        <ul className="pf-orbit mt-14 hidden list-none md:block" aria-label="Technologies">
          <li
            className="pf-kicker pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-hidden
          >
            Stack
          </li>
          {SKILLS.map((skill, i) => {
            const angle = (i / count) * 360;
            return (
              <li
                key={skill}
                className="pf-orbit-item"
                style={{
                  transform: `rotate(${angle}deg) translate(min(34vw, 15.5rem)) rotate(${-angle}deg)`,
                }}
              >
                <span className="pf-skill inline-block">{skill}</span>
              </li>
            );
          })}
        </ul>

        <motion.ul
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={stagger(0.04)}
          className="mt-10 flex flex-wrap gap-2 md:hidden"
        >
          {SKILLS.map((skill) => (
            <motion.li key={skill} variants={fadeUp}>
              <span className={cn("pf-skill inline-block")}>{skill}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
