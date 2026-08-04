"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SITE } from "@/lib/constants";

/**
 * First viewport for /studio: brand + one sentence + one CTA.
 * Product choice lives in the four cards below — not duplicated here.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-10 sm:pt-32 sm:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 10%, rgba(14,116,144,0.10), transparent 60%), radial-gradient(45% 40% at 90% 20%, rgba(15,118,110,0.10), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--sv-border-strong) 1px, transparent 1px), linear-gradient(90deg, var(--sv-border-strong) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <Container>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {SITE.name}
          </p>
          <p className="mt-5 text-lg text-ink-dim sm:text-xl">
            Write stories, ask questions, list a business, or find a freelancer
            — in one place.
          </p>
          <div className="mt-8 flex justify-center">
            <a href="#features">
              <Button size="lg" className="group">
                See what you can do
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Or{" "}
            <Link href="/sign-up" className="text-lilac hover:underline">
              get started free
            </Link>
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
