import type { Metadata } from "next";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";

export const metadata: Metadata = {
  title: "AFTIONIX Studio — Stories, answers, businesses, and gigs",
  description:
    "Write stories, ask questions, list a business, or find a freelancer — in one place.",
};

/**
 * Static marketing page — must not query the database at build time.
 * Keep the first screen scannable: intro + four products.
 * Pricing cards omitted while Story Studio UI is mid-rebuild; billing
 * still lives in Settings / Razorpay (see components/landing/pricing.tsx).
 */
export default function StudioLandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
      </main>
      <SiteFooter />
    </>
  );
}
