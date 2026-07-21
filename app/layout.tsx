import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFTIONIX Studio — AI writing, made memorable.",
  description:
    "A premium AI writing studio for long-form stories, scripts, characters, and worlds that stay in context.",
  keywords: ["AI writing", "screenplay", "storytelling", "character development", "writing studio"],
  openGraph: {
    title: "AFTIONIX Studio — AI writing, made memorable.",
    description:
      "A premium AI writing studio for long-form stories, scripts, characters, and worlds that stay in context.",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AFTIONIX Studio",
  applicationCategory: "CreativeWork",
  operatingSystem: "Web",
  description:
    "An AI writing studio for stories, scripts, characters, and worlds with persistent creative context.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-full flex flex-col bg-void text-ink font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
