"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 80% at 50% 100%, rgba(124,92,255,0.15), transparent 70%)",
        }}
      />
      <Container className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Your next episode is one instruction away.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-dim">
            Start free. No credit card, no character limit, no forgetting.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="group mt-8">
              Start Your Story
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </motion.div>
      </Container>
    </section>
  );
}
