export const PROJECTS = [
  {
    id: "studio",
    year: "2025 — 2026",
    title: "AFTIONIX Studio",
    role: "Founder · Product · Full stack",
    summary:
      "An AI platform for long-form stories with persistent memory, plus a verified business directory and freelancer–gig matching. Auth, usage limits, Razorpay billing, and production deploys on a VPS.",
    href: "/studio",
    hrefLabel: "Open Studio",
    tags: ["Next.js", "PostgreSQL", "Gemini", "OpenAI", "Razorpay"],
    accent: "cyan",
  },
  {
    id: "agency",
    year: "2025",
    title: "AFTIONIX",
    role: "Brand · Engineering",
    summary:
      "The agency site for AFTIONIX — positioning, services, and a conversion path for custom software, SaaS, and AI work. Same origin as Studio; separate visual system.",
    href: "/",
    hrefLabel: "Visit agency",
    tags: ["Next.js", "Motion", "SEO"],
    accent: "violet",
  },
  {
    id: "ai-systems",
    year: "Ongoing",
    title: "AI systems & automation",
    role: "Architecture · Delivery",
    summary:
      "Production assistants, document parsers, and operational workflows. The brief is always the same: remove real work, stay reliable, and ship behind a proper product surface.",
    href: "#contact",
    hrefLabel: "Talk about a build",
    tags: ["OpenAI", "Gemini", "Python", "Node.js"],
    accent: "amber",
  },
  {
    id: "platforms",
    year: "Ongoing",
    title: "SaaS & internal platforms",
    role: "Systems · Full stack",
    summary:
      "Multi-tenant dashboards, healthcare and school management, and internal tools. Typed backends, careful auth, and interfaces people can live in daily.",
    href: "#contact",
    hrefLabel: "Start a project",
    tags: ["TypeScript", "PostgreSQL", "Docker"],
    accent: "lime",
  },
] as const;

export type Project = (typeof PROJECTS)[number];
