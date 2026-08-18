export const PERSON = {
  name: "Anam Sayyed",
  firstName: "Anam",
  lastName: "Sayyed",
  role: "Full-Stack Developer",
  positioning: "AI • WEB • DIGITAL PRODUCTS",
  location: "India",
  email: "anamsayyed58@gmail.com",
  url: "https://aftionix.tech/portfolio",
  siteUrl: "https://aftionix.tech",
  whatsapp:
    "https://wa.me/918107738186?text=Hi%2C%20I%27d%20like%20to%20discuss%20a%20project",
  socials: {
    linkedin: "https://www.linkedin.com/in/sayyedanam/",
    github: "https://github.com/Anamsayyed016",
    instagram: "https://www.instagram.com/anam_sayyed_16/",
  },
} as const;

export const NAV = [
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Experience", href: "#experience" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
] as const;

export const HERO = {
  kicker: "Full-Stack Developer",
  headline: ["Building digital products", "that feel alive."],
  body: "Full-Stack Developer focused on modern web applications, AI-powered products and meaningful digital experiences.",
  status: "Available for select projects",
  meta: [
    "Based in India",
    "Full-stack / AI",
    "Next.js / Python",
    "Open to opportunities",
  ],
} as const;

export const ABOUT = {
  heading: "More than code.",
  body: "I'm a Full-Stack Developer who enjoys turning ideas into useful, polished digital products. I work across frontend, backend, databases and AI integrations — from the first interface to production deployment.",
  stats: [
    { value: "3+", label: "Years building" },
    { value: "10+", label: "Projects" },
    { value: "Full-stack", label: "Focus" },
  ],
} as const;

export const JOURNEY = [
  {
    id: "fullstack",
    title: "Full-Stack Development",
    body: "Interfaces, APIs and data models designed as one system — typed, reviewable, and ready for real users.",
  },
  {
    id: "ai",
    title: "AI integrations",
    body: "LLM-backed features, assistants and workflows wired into products with clear failure modes and production constraints.",
  },
  {
    id: "product",
    title: "Product development",
    body: "From brief to shipped surface: structure, experience, and the details that make software feel finished.",
  },
  {
    id: "websites",
    title: "Client & business websites",
    body: "Responsive brand and catalogue sites with performance, SEO and a path to iterate after launch.",
  },
  {
    id: "deploy",
    title: "Production deployment",
    body: "Auth, databases, payments and deploys treated as part of the product — not a later phase.",
  },
] as const;

export const SERVICES = [
  {
    id: "fullstack",
    index: "01",
    title: "Full-Stack Development",
    body: "Modern frontend + scalable backend systems.",
  },
  {
    id: "ai",
    index: "02",
    title: "AI-Powered Products",
    body: "LLM integrations, AI workflows and intelligent product features.",
  },
  {
    id: "saas",
    index: "03",
    title: "SaaS & Web Applications",
    body: "Production-ready platforms and dashboards.",
  },
  {
    id: "web",
    index: "04",
    title: "Business Websites",
    body: "Premium responsive websites for brands and businesses.",
  },
] as const;

export const PROCESS = [
  {
    index: "01",
    title: "Discover",
    body: "Understand the idea and requirements.",
  },
  {
    index: "02",
    title: "Design",
    body: "Create the structure and experience.",
  },
  {
    index: "03",
    title: "Build",
    body: "Develop frontend, backend and integrations.",
  },
  {
    index: "04",
    title: "Launch",
    body: "Test, optimize and deploy.",
  },
] as const;

export const SEO = {
  title: "Anam Sayyed — Full-Stack Developer",
  description:
    "Anam Sayyed is a Full-Stack Developer building modern web applications, AI-powered products and digital experiences.",
} as const;
