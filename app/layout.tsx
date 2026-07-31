import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AFTIONIX Studio — One assistant. Stories, answers, and what's next.",
  description:
    "An AI platform for writing stories with memory, getting answers, and — soon — listing businesses and finding jobs.",
  keywords: [
    "AI assistant",
    "AI writing",
    "story studio",
    "character memory",
    "AFTIONIX",
  ],
  openGraph: {
    title: "AFTIONIX Studio — One assistant. Stories, answers, and what's next.",
    description:
      "Write fiction that remembers, ask questions, get coding help — all in one place. Directory and Jobs coming soon.",
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
    "An AI platform for writing stories with memory, getting answers, and upcoming business directory and jobs.",
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
