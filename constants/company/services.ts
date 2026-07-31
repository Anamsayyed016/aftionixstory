import {
  Code2,
  Globe,
  Layers,
  BrainCircuit,
  Clapperboard,
  PenTool,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import type { ServiceCard } from "@/types/company";

export const SERVICES: ServiceCard[] = [
  {
    id: "custom-software",
    title: "Custom Software Development",
    summary:
      "ERP, CRM, HRMS, inventory, and hospital or school management systems built around how your business actually runs.",
    bullets: ["ERP & CRM systems", "Hospital / School management", "Internal business tools"],
    icon: Code2,
  },
  {
    id: "websites",
    title: "Website Development",
    summary:
      "Corporate sites, landing pages, and PWAs engineered for speed, SEO, and conversion — not just good looks.",
    bullets: ["Corporate & business sites", "Landing pages", "Progressive Web Apps"],
    icon: Globe,
  },
  {
    id: "saas",
    title: "SaaS Development",
    summary:
      "Multi-tenant platforms, subscription billing, and admin dashboards built to scale from first user to thousandth.",
    bullets: ["Multi-tenant architecture", "Subscription platforms", "Admin dashboards"],
    icon: Layers,
  },
  {
    id: "ai",
    title: "AI Development",
    summary:
      "OpenAI and Gemini-powered assistants, document parsers, and automation that removes real operational work.",
    bullets: ["AI assistants & chatbots", "Resume & document parsers", "Workflow automation"],
    icon: BrainCircuit,
  },
  {
    id: "ai-advertisements",
    title: "AI Advertisement Creation",
    summary:
      "Our dedicated high-converting AI marketing service — cinematic product ads, Reels, and full brand campaigns.",
    bullets: ["AI product commercials", "Reels & YouTube Shorts", "AI avatar presenters"],
    icon: Clapperboard,
  },
  {
    id: "design",
    title: "UI/UX Design",
    summary:
      "Figma design systems, wireframes, and interactive prototypes that hold up once engineering takes over.",
    bullets: ["Design systems", "Wireframes & prototypes", "Interaction design"],
    icon: PenTool,
  },
  {
    id: "ecommerce",
    title: "E-commerce Development",
    summary:
      "Online stores with real payment gateways, inventory sync, and order management — not a plugin stack.",
    bullets: ["Payment gateway integration", "Inventory & order management", "Storefront + admin"],
    icon: ShoppingCart,
  },
  {
    id: "mobile",
    title: "Mobile Applications",
    summary:
      "Responsive apps and PWAs for business use cases where a native app store listing isn't the priority.",
    bullets: ["Responsive mobile apps", "PWAs", "Business-focused UX"],
    icon: Smartphone,
  },
];
