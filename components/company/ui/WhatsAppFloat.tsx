"use client";

import { motion } from "framer-motion";
import { WhatsAppIcon } from "@/components/company/ui/SocialIcons";
import { SITE } from "@/constants/company/site";
import { EASE } from "@/animations/company/variants";

export function WhatsAppFloat() {
  return (
    <motion.a
      href={SITE.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.55 }}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--co-primary),var(--co-accent))] text-white shadow-[var(--shadow-glow-primary)] transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none sm:size-14"
    >
      <WhatsAppIcon className="size-6 sm:size-7" aria-hidden />
    </motion.a>
  );
}
