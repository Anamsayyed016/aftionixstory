"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/company/ui/Container";
import { SectionEyebrow } from "@/components/company/ui/SectionEyebrow";
import { fadeUp, revealViewport, staggerContainer } from "@/animations/company/variants";
import { SERVICES } from "@/constants/company/services";

export function Services() {
  return (
    <section id="services" className="bg-canvas-soft py-24 sm:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>services</SectionEyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Everything a modern product needs, under one roof.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            From first architecture decision to the ad campaign that launches
            it — we cover the full stack of building and shipping software.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={staggerContainer(0.06)}
          className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.id}
                variants={fadeUp}
                className="group flex flex-col rounded-[var(--radius-lg)] border border-border bg-white p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-lifted)]"
              >
                <div className="flex size-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--sv-accent-subtle)] text-primary transition-colors group-hover:bg-[linear-gradient(135deg,var(--co-primary),var(--co-accent))] group-hover:text-white">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 font-display text-base font-semibold text-ink">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {service.summary}
                </p>
                <ul className="mt-4 space-y-2">
                  {service.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-xs text-ink-soft">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/services#${service.id}`}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary-dim"
                >
                  Learn more
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}
