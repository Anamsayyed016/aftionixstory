export const PERSON = {
  name: "Anam Sayyed",
  role: "Founder & Software Engineer",
  studio: "AFTIONIX",
  experience: "4+ Years",
  location: "India · Remote",
  tagline: "I build intelligent software, AI products, and systems that hold up in production.",
  summary:
    "Founder of AFTIONIX. I design and ship custom software, SaaS platforms, and AI systems for startups, healthcare, and enterprises — from architecture through launch and maintenance.",
  email: "anamsayyed58@gmail.com",
  whatsapp:
    "https://wa.me/918107738186?text=Hi%2C%20I%27d%20like%20to%20discuss%20a%20project",
  url: "https://aftionix.tech/portfolio",
  siteUrl: "https://aftionix.tech",
  socials: {
    linkedin: "https://www.linkedin.com/in/sayyedanam/",
    github: "https://github.com/Anamsayyed016",
    instagram: "https://www.instagram.com/anam_sayyed_16/",
  },
} as const;

export const NAV = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Stack", href: "#stack" },
  { label: "Experience", href: "#experience" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;

export const STATS = [
  { value: "4+", label: "Years shipping" },
  { value: "8", label: "Service lines" },
  { value: "AI + SaaS", label: "Focus" },
  { value: "Remote", label: "Worldwide" },
] as const;

export const PRINCIPLES = [
  {
    title: "Production first",
    body: "Architecture, auth, billing, and ops are part of the product — not a later phase.",
  },
  {
    title: "Systems that last",
    body: "Typed, documented, and structured so the next engineer can move without archaeology.",
  },
  {
    title: "Practical AI",
    body: "Assistants, parsers, and automation that remove real work. No demo that never ships.",
  },
] as const;

export const EXPERIENCE = [
  {
    period: "2022 — Present",
    title: "Founder & Lead Engineer",
    org: "AFTIONIX",
    location: "Remote",
    points: [
      "Built and operate AFTIONIX Studio — AI writing with memory, a business directory, and freelancer matching.",
      "Ship custom software, SaaS, and AI integrations for startups, healthcare, and enterprise clients.",
      "Own product, architecture, and delivery: Next.js, PostgreSQL, auth, billing, and production deploys.",
    ],
  },
  {
    period: "2021 — 2022",
    title: "Independent Software Engineer",
    org: "Client work",
    location: "Remote",
    points: [
      "Designed and delivered web platforms, internal tools, and conversion-focused sites end to end.",
      "Worked across UI, APIs, and deployment — from first brief to a system people actually use.",
    ],
  },
] as const;

export const SERVICES = [
  {
    id: "custom-software",
    title: "Custom software",
    body: "ERP, CRM, HRMS, and domain systems shaped around how the business actually runs.",
  },
  {
    id: "saas",
    title: "SaaS platforms",
    body: "Multi-tenant products, subscriptions, and admin surfaces built to grow with usage.",
  },
  {
    id: "ai",
    title: "AI products",
    body: "Assistants, document parsers, and workflow automation on OpenAI and Gemini.",
  },
  {
    id: "web",
    title: "Web & PWA",
    body: "Fast, SEO-aware sites and apps — engineered for conversion, not just presentation.",
  },
  {
    id: "commerce",
    title: "E-commerce",
    body: "Stores with real payments, inventory, and order flow — not a plugin pile.",
  },
  {
    id: "design",
    title: "UI / UX",
    body: "Design systems and prototypes that survive contact with engineering.",
  },
] as const;
