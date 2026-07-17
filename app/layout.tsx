import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoryVerse AI — Your stories remember everything.",
  description:
    "Create long-form, episodic AI stories with persistent character and plot memory. Define characters, generate episodes, and continue your story without losing a single detail.",
  keywords: [
    "AI storytelling",
    "episodic fiction",
    "AI story generator",
    "character memory",
    "story writing platform",
  ],
  openGraph: {
    title: "StoryVerse AI — Your stories remember everything.",
    description:
      "Create long-form, episodic AI stories with persistent character and plot memory.",
    type: "website",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "StoryVerse AI",
  applicationCategory: "CreativeWork",
  operatingSystem: "Web",
  description:
    "An AI storytelling platform for long-form episodic stories with persistent character and plot memory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
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
