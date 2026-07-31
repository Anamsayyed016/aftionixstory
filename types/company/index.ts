import type { LucideIcon } from "lucide-react";

export type NavLink = {
  label: string;
  href: string;
};

export type IconFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type ServiceCard = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  icon: LucideIcon;
};

export type ProjectCard = {
  id: string;
  title: string;
  category: string;
  summary: string;
  challenge: string;
  solution: string;
  features: string[];
  stack: string[];
  image: string;
  demoUrl?: string;
  githubUrl?: string;
  caseStudyUrl?: string;
};

export type PricingTier = {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  company: string;
  quote: string;
  avatar: string;
  rating: number;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type ProcessStep = {
  index: string;
  title: string;
  description: string;
};
