import type { Metadata } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";

import "./portfolio.css";
import { PERSON } from "@/constants/portfolio/content";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { Footer } from "@/components/portfolio/Footer";

export const metadata: Metadata = {
  title: PERSON.name,
  description: PERSON.tagline,
  keywords: [
    PERSON.name,
    PERSON.studio,
    "software engineer",
    "AI products",
    "SaaS",
    "Next.js",
    "portfolio",
  ],
  authors: [{ name: PERSON.name, url: PERSON.url }],
  openGraph: {
    type: "profile",
    title: `${PERSON.name} — ${PERSON.role}`,
    description: PERSON.tagline,
    url: PERSON.url,
    siteName: PERSON.studio,
  },
  robots: { index: true, follow: true },
};

const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: PERSON.name,
  jobTitle: PERSON.role,
  worksFor: {
    "@type": "Organization",
    name: PERSON.studio,
    url: PERSON.siteUrl,
  },
  url: PERSON.url,
  email: PERSON.email,
  sameAs: [
    PERSON.socials.linkedin,
    PERSON.socials.github,
    PERSON.socials.instagram,
  ],
};

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="portfolio" className="pf-shell">
      <a href="#main" className="pf-skip">
        Skip to content
      </a>
      <PortfolioHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
    </div>
  );
}
