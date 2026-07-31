import {
  CalendarClock,
  GitBranch,
  Zap,
  Search,
  BrainCircuit,
  TrendingUp,
  MessageCircle,
  LifeBuoy,
  Gauge,
  Palette,
} from "lucide-react";
import type { IconFeature } from "@/types/company";
import { SITE } from "@/constants/company/site";

export const WHY_CHOOSE_US: IconFeature[] = [
  { icon: CalendarClock, title: `${SITE.experience} Experience`, description: "Real production history, not a portfolio of side projects." },
  { icon: GitBranch, title: "Clean Architecture", description: "Code organized for the developer who inherits it next." },
  { icon: Zap, title: "Fast Delivery", description: "Realistic timelines, hit consistently — no disappearing acts." },
  { icon: Search, title: "SEO Optimized", description: "Built to be found, not bolted on after launch." },
  { icon: BrainCircuit, title: "AI Expertise", description: "Practical AI integration, not a demo that never ships." },
  { icon: TrendingUp, title: "Scalable Code", description: "Architecture that holds up under real user growth." },
  { icon: MessageCircle, title: "Transparent Communication", description: "You always know what's built, what's next, and why." },
  { icon: LifeBuoy, title: "Dedicated Support", description: "Maintenance and support after launch, not just before." },
  { icon: Gauge, title: "Performance Focused", description: "Lighthouse scores and load times treated as requirements." },
  { icon: Palette, title: "Modern UI/UX", description: "Interfaces designed for how people actually use software." },
];
