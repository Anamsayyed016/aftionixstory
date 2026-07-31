"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, PlayCircle, Sparkles } from "lucide-react";
import { Container } from "@/components/company/ui/Container";
import { Button } from "@/components/company/ui/Button";
import { Badge } from "@/components/company/ui/Badge";
import { GlassCard } from "@/components/company/ui/GlassCard";
import { fadeUp, staggerContainer } from "@/animations/company/variants";
import { SITE } from "@/constants/company/site";

const CODE_LINES = [
  { indent: 0, text: "export function Dashboard() {" },
  { indent: 1, text: "const { data } = useMetrics();" },
  { indent: 1, text: "" },
  { indent: 1, text: "return (" },
  { indent: 2, text: "<RevenueCard data={data} />" },
  { indent: 1, text: ");" },
  { indent: 0, text: "}" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-40 lg:pt-48">
      <div className="bg-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" />

      <Container>
        <motion.div
          variants={staggerContainer(0.1)}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge icon={Sparkles}>
              Founded by {SITE.founder} · {SITE.experience} Experience
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-6 text-balance font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.75rem]"
          >
            We Build Modern Software
            <br />
            That <span className="text-gradient-brand">Grows Businesses.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-ink-soft"
          >
            {SITE.name} designs and ships custom software, AI products, and
            SaaS platforms for startups, healthcare companies, and
            enterprises — built to last, not just to launch.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Button href="/contact" icon={ArrowUpRight}>
              Start Your Project
            </Button>
            <Button href="/studio" variant="secondary" icon={PlayCircle} iconPosition="left">
              Open AFTIONIX Studio
            </Button>
            <Button href="/contact" variant="ghost">
              Schedule Free Consultation
            </Button>
          </motion.div>
        </motion.div>

        {/* Signature visual: code compiling into product */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-20 grid max-w-4xl grid-cols-1 items-center gap-0 lg:grid-cols-[1fr_auto_1fr]"
        >
          {/* Code card */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <GlassCard className="relative z-10 overflow-hidden bg-[var(--co-canvas-deep)]/95 p-5 shadow-[var(--shadow-lifted)] lg:translate-x-6">
              <div className="flex items-center gap-1.5 pb-3">
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="size-2.5 rounded-full bg-white/20" />
                <span className="ml-2 font-mono text-[11px] text-white/40">
                  dashboard.tsx
                </span>
              </div>
              <div className="font-mono text-[13px] leading-relaxed">
                {CODE_LINES.map((line, i) => (
                  <div key={i} style={{ paddingLeft: `${line.indent * 1}rem` }}>
                    <span className="text-white/70">{line.text || "\u00A0"}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Connector */}
          <div className="hidden h-px w-10 bg-[linear-gradient(90deg,transparent,var(--co-accent))] lg:block" />

          {/* Product card */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          >
            <GlassCard className="relative z-20 -mt-10 p-5 shadow-[var(--shadow-lifted)] lg:-mt-0 lg:-translate-x-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-ink">
                  Revenue
                </span>
                <Badge variant="soft" className="!py-0.5 !text-[10px]">
                  +24.6%
                </Badge>
              </div>
              <div className="mt-4 flex h-20 items-end gap-1.5">
                {[40, 65, 50, 80, 60, 95, 72].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-[linear-gradient(180deg,var(--co-primary),var(--co-accent))]"
                    style={{ height: `${h}%`, opacity: 0.55 + i * 0.06 }}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                <div className="size-7 rounded-full bg-[linear-gradient(135deg,var(--co-primary),var(--co-accent))]" />
                <div className="h-2 flex-1 rounded-full bg-canvas-soft" />
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
