import type { Metadata } from "next";

import "./globals.css";

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-full flex flex-col bg-void text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
