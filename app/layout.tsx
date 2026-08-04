import type { Metadata } from "next";

import "./globals.css";

/** Google AdSense publisher client — sitewide verification + future ad units. */
const ADSENSE_CLIENT = "ca-pub-6006196480466195";

export const metadata: Metadata = {
  title: {
    default: "AFTIONIX — Software, AI & Studio",
    template: "%s — AFTIONIX",
  },
  description:
    "AFTIONIX builds software and AI products — from custom development to AFTIONIX Studio for stories, answers, business listings, and freelancer gigs.",
  keywords: [
    "AFTIONIX",
    "software development agency",
    "AI assistant",
    "AI writing",
    "story studio",
    "business directory",
    "freelancer connect",
  ],
  openGraph: {
    title: "AFTIONIX — Software, AI & Studio",
    description:
      "Premium software agency and AFTIONIX Studio — stories, answers, business listings, and freelancer connect.",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AFTIONIX Studio",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "An AI platform for writing stories with memory, listing businesses, and connecting freelancers to gigs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
          AdSense verification crawlers often read initial SSR HTML without JS.
          next/script afterInteractive only preloads — use a raw head script so
          view-source / curl show the real <script src="...adsbygoogle.js?client=...">.
        */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-void text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
