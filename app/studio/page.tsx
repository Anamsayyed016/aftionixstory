import type { Metadata } from "next";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";

export const metadata: Metadata = {
  title: "AFTIONIX Studio — One assistant. Stories, answers, and what's next.",
  description:
    "An AI platform for writing stories with memory, getting answers, listing businesses, and connecting freelancers to gigs.",
};

export default function StudioLandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <ProductShowcase />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
