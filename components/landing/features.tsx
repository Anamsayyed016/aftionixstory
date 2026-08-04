"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  MessageCircle,
  Building2,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STUDIO_PRODUCT_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "story-studio": Sparkles,
  assistant: MessageCircle,
  "business-directory": Building2,
  "freelancer-connect": Briefcase,
};

export function Features() {
  const featured = STUDIO_PRODUCT_CARDS.find((p) => p.featured);
  const rest = STUDIO_PRODUCT_CARDS.filter((p) => !p.featured);

  return (
    <section id="features" className="pb-20 sm:pb-28">
      <Container>
        <div className="space-y-5">
          {featured ? (
            <ProductCard product={featured} lead />
          ) : null}

          <div className="grid gap-5 sm:grid-cols-3">
            {rest.map((product, i) => (
              <ProductCard key={product.id} product={product} delay={0.06 * (i + 1)} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function ProductCard({
  product,
  lead = false,
  delay = 0,
}: {
  product: (typeof STUDIO_PRODUCT_CARDS)[number];
  lead?: boolean;
  delay?: number;
}) {
  const Icon = ICONS[product.id] ?? Sparkles;
  const live = product.status === "live";

  return (
    <motion.div
      id={product.id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay }}
    >
      <GlassCard
        hover
        className={cn(
          "flex h-full flex-col p-6 sm:p-7",
          lead && "border-violet/40 sm:flex-row sm:items-center sm:gap-8 sm:p-8"
        )}
      >
        <div className={cn(lead && "sm:flex-1")}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
              <Icon className="h-5 w-5" />
            </span>
            {live ? (
              <Badge variant="success" dot>
                Live
              </Badge>
            ) : null}
          </div>
          <h2
            className={cn(
              "mt-4 font-display font-semibold tracking-tight text-ink",
              lead ? "text-2xl sm:text-3xl" : "text-lg"
            )}
          >
            {product.title}
          </h2>
          <p
            className={cn(
              "mt-2 text-ink-dim",
              lead ? "text-base sm:max-w-xl" : "text-sm"
            )}
          >
            {product.benefit}
          </p>
        </div>
        <div className={cn("mt-6", lead && "sm:mt-0 sm:shrink-0")}>
          <Link href={product.href}>
            <Button
              variant={lead ? "primary" : "secondary"}
              className="w-full sm:w-auto"
            >
              {product.cta}
            </Button>
          </Link>
        </div>
      </GlassCard>
    </motion.div>
  );
}
