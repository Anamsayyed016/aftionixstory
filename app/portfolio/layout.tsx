import type { Metadata } from "next";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";

import "./portfolio.css";
import { PERSON, SEO } from "@/constants/portfolio/content";
import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { Footer } from "@/components/portfolio/Footer";
import { MotionRoot } from "@/components/portfolio/MotionRoot";

export const metadata: Metadata = {
  title: {
    absolute: SEO.title,
  },
  description: SEO.description,
  keywords: [
    PERSON.name,
    "Full-Stack Developer",
    "Next.js",
    "Python",
    "AI",
    "portfolio",
  ],
  authors: [{ name: PERSON.name, url: PERSON.url }],
  openGraph: {
    type: "profile",
    title: SEO.title,
    description: SEO.description,
    url: PERSON.url,
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${PERSON.url}#person`,
      name: PERSON.name,
      jobTitle: PERSON.role,
      url: PERSON.url,
      email: PERSON.email,
      address: {
        "@type": "PostalAddress",
        addressCountry: "IN",
      },
      sameAs: [PERSON.socials.linkedin, PERSON.socials.github, PERSON.socials.instagram],
    },
    {
      "@type": "ProfilePage",
      "@id": PERSON.url,
      name: SEO.title,
      url: PERSON.url,
      mainEntity: { "@id": `${PERSON.url}#person` },
    },
  ],
};

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionRoot>
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </div>
    </MotionRoot>
  );
}
