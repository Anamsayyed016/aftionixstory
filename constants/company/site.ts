export const SITE = {
  name: "AFTIONIX",
  founder: "Anam Sayyed",
  tagline: "Building Intelligent Software & AI Solutions for Modern Businesses.",
  experience: "4+ Years",
  url: "https://aftionix.tech",
  description:
    "AFTIONIX is a premium software development agency building custom software, SaaS platforms, AI solutions, and high-converting AI advertisement content for startups, healthcare companies, and enterprises.",
  email: "hello@aftionix.tech",
  whatsapp: "https://wa.me/910000000000",
  socials: {
    linkedin: "https://linkedin.com/company/aftionix",
    github: "https://github.com/aftionix",
    instagram: "https://instagram.com/aftionix",
  },
} as const;

export type NavLink = {
  label: string;
  href: string;
};

export const NAV_LINKS: NavLink[] = [
  { label: "About", href: "/#about" },
  { label: "Services", href: "/#services" },
  { label: "Process", href: "/#process" },
  { label: "Studio", href: "/studio" },
  { label: "Contact", href: "/contact" },
];

export const FOOTER_LINKS = {
  services: [
    { label: "Custom Software Development", href: "/#services" },
    { label: "Website Development", href: "/#services" },
    { label: "SaaS Development", href: "/#services" },
    { label: "AI Development", href: "/#services" },
    { label: "AFTIONIX Studio", href: "/studio" },
    { label: "UI/UX Design", href: "/#services" },
    { label: "E-commerce Development", href: "/#services" },
    { label: "Mobile Applications", href: "/#services" },
  ],
  company: [
    { label: "About AFTIONIX", href: "/#about" },
    { label: "Process", href: "/#process" },
    { label: "AFTIONIX Studio", href: "/studio" },
    { label: "Contact", href: "/contact" },
  ],
} as const;
