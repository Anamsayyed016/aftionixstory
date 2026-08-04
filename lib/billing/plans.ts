import type { Plan } from "@prisma/client";

export type PaidPlan = Exclude<Plan, "FREE">;

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === "WRITER" || plan === "STUDIO";
}

export const PAID_PLAN_LABELS: Record<PaidPlan, string> = {
  WRITER: "Writer",
  STUDIO: "Studio",
};

/** Display amounts for INR marketing (must match Razorpay Plan amounts). */
export const PAID_PLAN_INR: Record<PaidPlan, number> = {
  WRITER: 199,
  STUDIO: 599,
};
