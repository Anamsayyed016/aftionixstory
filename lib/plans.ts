export type PlanKey = "FREE" | "WRITER" | "STUDIO";

export const PLAN_LIMITS = {
  FREE: {
    label: "Free",
    maxStories: 3,
    maxActiveCharactersPerStory: 15,
    generationLimit: 20,
  },
  WRITER: {
    label: "Writer",
    maxStories: 25,
    maxActiveCharactersPerStory: 40,
    generationLimit: 200,
  },
  STUDIO: {
    label: "Studio",
    maxStories: 100,
    maxActiveCharactersPerStory: 100,
    generationLimit: 1000,
  },
} as const;

export function getPlanLimits(plan: string) {
  if (plan === "WRITER" || plan === "STUDIO") {
    return PLAN_LIMITS[plan];
  }
  return PLAN_LIMITS.FREE;
}
