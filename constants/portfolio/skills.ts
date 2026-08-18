export const SKILL_GROUPS = [
  {
    id: "frontend",
    label: "Interface",
    items: ["React", "Next.js", "TypeScript", "Tailwind CSS", "Framer Motion"],
  },
  {
    id: "backend",
    label: "Systems",
    items: ["Node.js", "Python", "Django", "FastAPI"],
  },
  {
    id: "data",
    label: "Data",
    items: ["PostgreSQL", "MongoDB", "MySQL", "Redis"],
  },
  {
    id: "cloud",
    label: "Cloud & AI",
    items: ["Docker", "AWS", "Firebase", "Supabase", "OpenAI", "Gemini"],
  },
] as const;

export const HIGHLIGHT_SKILLS = [
  "Next.js",
  "TypeScript",
  "PostgreSQL",
  "OpenAI",
  "Gemini",
  "Docker",
] as const;
