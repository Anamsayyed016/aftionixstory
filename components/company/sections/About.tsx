"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/company/ui/Container";
import { SectionEyebrow } from "@/components/company/ui/SectionEyebrow";
import { Badge } from "@/components/company/ui/Badge";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/company/variants";
import { SITE } from "@/constants/company/site";

const SPECIALIZATIONS = [
  "Custom Software",
  "AI Solutions",
  "Enterprise Applications",
  "SaaS Platforms",
  "Startup Products",
  "Automation",
  "Long-Term Maintenance",
];

const PRINCIPLES = [
  {
    title: "Clean architecture",
    description: "Systems built to be understood, extended, and handed off — not just shipped.",
  },
  {
    title: "Client-centric process",
    description: "Every engagement starts with your business logic, not a generic template.",
  },
  {
    title: "Modern, proven stack",
    description: "Next.js, TypeScript, and production-grade AI tooling — no experimental dead ends.",
  },
];

export function About() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={staggerContainer(0.1)}
          >
            <motion.div variants={fadeUp}>
              <SectionEyebrow>about {SITE.name.toLowerCase()}</SectionEyebrow>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="mt-4 text-balance font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl"
            >
              A premium software partner, not a freelance gig.
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Founded by {SITE.founder}, {SITE.name} has spent {SITE.experience.toLowerCase()}{" "}
              building production software for startups, healthcare
              organizations, and enterprises — from first line of code to
              long-term maintenance.
            </motion.p>
            <motion.p variants={fadeUp} className="mt-4 max-w-lg leading-relaxed text-ink-soft">
              We don&apos;t hand off a repo and disappear. Every engagement is
              built on clean architecture and a modern stack so the product
              stays maintainable long after launch.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={staggerContainer(0.1, 0.15)}
            className="space-y-4"
          >
            {PRINCIPLES.map((principle, i) => (
              <motion.div
                key={principle.title}
                variants={fadeUp}
                className="group rounded-[var(--radius-lg)] border border-border bg-canvas-soft/60 p-6 transition-colors hover:border-primary/30"
              >
                <span className="font-mono text-xs text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {principle.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
