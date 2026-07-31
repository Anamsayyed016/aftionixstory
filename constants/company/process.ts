import type { ProcessStep } from "@/types/company";

export const PROCESS_STEPS: ProcessStep[] = [
  { index: "01", title: "Discovery", description: "Understanding your business, users, and what success actually looks like." },
  { index: "02", title: "Research", description: "Competitive landscape, technical constraints, and the right stack for the job." },
  { index: "03", title: "Planning", description: "Scope, milestones, and architecture decisions — documented before code starts." },
  { index: "04", title: "UI/UX Design", description: "Wireframes and interactive prototypes validated before a single component is built." },
  { index: "05", title: "Development", description: "Clean, typed, tested code shipped in reviewable increments." },
  { index: "06", title: "Testing", description: "Functional, performance, and cross-device testing before anything goes live." },
  { index: "07", title: "Deployment", description: "Production rollout with monitoring in place from day one." },
  { index: "08", title: "Maintenance", description: "Ongoing support, fixes, and iteration after launch — not a handoff and goodbye." },
];
