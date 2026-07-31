import type { Metadata } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import { Header } from "@/components/company/sections/Header";
import { Footer } from "@/components/company/sections/Footer";
import { WhatsAppFloat } from "@/components/company/ui/WhatsAppFloat";
import { SITE } from "@/constants/company/site";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — Premium Software Development Agency`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "software development agency",
    "custom software development",
    "AI development company",
    "SaaS development",
    "AI advertisement agency",
    "AFTIONIX Studio",
    "Anam Sayyed",
    "AFTIONIX",
  ],
  authors: [{ name: SITE.founder }],
  openGraph: {
    type: "website",
    title: `${SITE.name} — Premium Software Development Agency`,
    description: SITE.description,
    siteName: SITE.name,
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  founder: {
    "@type": "Person",
    name: SITE.founder,
  },
  url: SITE.url,
  description: SITE.description,
  sameAs: [
    SITE.socials.linkedin,
    SITE.socials.github,
    SITE.socials.instagram,
    SITE.socials.whatsapp,
  ],
};

export default function CompanyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div data-theme="company" className="flex min-h-full flex-1 flex-col bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <WhatsAppFloat />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </div>
  );
}
