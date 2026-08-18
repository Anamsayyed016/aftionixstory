export type ProjectLink = string | null;

export const PROJECTS = [
  {
    id: "naukrimili",
    index: "01",
    title: "NaukriMili",
    category: "AI Job Platform",
    description:
      "A multi-country job platform combining job discovery, resume tools, AI assistance and recruiter-oriented workflows.",
    tags: ["Next.js", "React", "TypeScript", "Python", "PostgreSQL", "Prisma", "AI"],
    href: null as ProjectLink,
    featured: true,
    visual: "constellation",
  },
  {
    id: "studio",
    index: "02",
    title: "AFTIONIX Studio",
    category: "AI Platform",
    description:
      "An AI-powered platform combining stories with memory, universal assistance, business discovery and freelancer connections.",
    tags: [
      "Next.js",
      "React",
      "TypeScript",
      "Prisma",
      "PostgreSQL",
      "Gemini",
      "OpenAI",
      "Razorpay",
    ],
    href: "/studio" as ProjectLink,
    featured: false,
    visual: "memory",
  },
  {
    id: "pharmefc",
    index: "03",
    title: "Pharmefc",
    category: "Healthcare Web Platform",
    description:
      "A modern responsive pharmaceutical product catalogue and company website.",
    tags: ["Next.js", "React", "Tailwind CSS", "Cloudinary"],
    href: null as ProjectLink,
    featured: false,
    visual: "grid",
  },
  {
    id: "sambhavi",
    index: "04",
    title: "Sambhavi Handloom",
    category: "E-commerce",
    description:
      "A premium fashion e-commerce experience designed around Indian handloom sarees and visual storytelling.",
    tags: ["Next.js", "React", "Tailwind CSS", "Modern UI/UX"],
    href: null as ProjectLink,
    featured: true,
    visual: "weave",
  },
] as const;

export type Project = (typeof PROJECTS)[number];
