import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AFTIONIX Studio — One assistant. Stories, answers, and what's next.",
  description:
    "An AI platform for writing stories with memory, getting answers, listing businesses, and connecting freelancers to gigs.",
  keywords: [
    "AI assistant",
    "AI writing",
    "story studio",
    "business directory",
    "freelancer connect",
    "AFTIONIX",
  ],
  openGraph: {
    title: "AFTIONIX Studio — One assistant. Stories, answers, and what's next.",
    description:
      "Write fiction that remembers, ask questions, list a business, or match a gig — connect-only (no payments in v1).",
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
