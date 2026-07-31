import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/constants/company/site";
import { Container } from "@/components/company/ui/Container";
import { Button } from "@/components/company/ui/Button";
import { SectionEyebrow } from "@/components/company/ui/SectionEyebrow";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${SITE.name} for software, AI, and product work.`,
};

export default function ContactPage() {
  return (
    <section className="pb-24 pt-36 sm:pt-40">
      <Container className="max-w-2xl text-center">
        <SectionEyebrow>Contact</SectionEyebrow>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink">
          Let&apos;s build something together
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Tell us about your project — custom software, AI products, or SaaS.
          We usually reply within one business day.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button href={`mailto:${SITE.email}`}>Email {SITE.email}</Button>
          <Button href={SITE.whatsapp} variant="secondary">
            WhatsApp
          </Button>
          <Button href="/studio" variant="ghost">
            Try AFTIONIX Studio
          </Button>
        </div>
        <p className="mt-10 text-sm text-ink-faint">
          Or browse{" "}
          <Link href="/#services" className="text-primary underline-offset-2 hover:underline">
            our services
          </Link>
          .
        </p>
      </Container>
    </section>
  );
}
