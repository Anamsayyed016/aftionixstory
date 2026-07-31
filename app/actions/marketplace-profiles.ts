"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  createGigRequest,
  saveBusinessProfile,
  saveFreelancerProfile,
} from "@/lib/marketplace/mutations";
import {
  businessProfileSchema,
  freelancerProfileSchema,
  gigPostingSchema,
} from "@/lib/marketplace/schemas";

function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function saveBusinessProfileAction(
  _prev: ActionResult<{ publicPath: string }> | null,
  formData: FormData
): Promise<ActionResult<{ publicPath: string }>> {
  const user = await requireUser();
  const parsed = businessProfileSchema.safeParse({
    name: formString(formData, "name"),
    category: formString(formData, "category") || undefined,
    location: formString(formData, "location") || undefined,
    contactEmail: formString(formData, "contactEmail"),
    contactPhone: formString(formData, "contactPhone") || undefined,
    summary: formString(formData, "summary") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Please fix the highlighted fields.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const business = await saveBusinessProfile({
    userId: user.id,
    data: parsed.data,
    fallbackEmail: user.email,
  });

  revalidatePath("/connect");
  revalidatePath(`/b/${business.slug}`);
  return ok(
    { publicPath: `/b/${business.slug}` },
    "Business listing saved."
  );
}

export async function saveFreelancerProfileAction(
  _prev: ActionResult<{ publicPath: string }> | null,
  formData: FormData
): Promise<ActionResult<{ publicPath: string }>> {
  const user = await requireUser();
  const parsed = freelancerProfileSchema.safeParse({
    summary: formString(formData, "summary"),
    skills: formString(formData, "skills"),
    location: formString(formData, "location") || undefined,
    availability: formString(formData, "availability") || undefined,
    portfolioLinks: formString(formData, "portfolioLinks"),
    contactEmail: formString(formData, "contactEmail"),
    contactPhone: formString(formData, "contactPhone") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Please fix the highlighted fields.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const profile = await saveFreelancerProfile({
    userId: user.id,
    data: parsed.data,
    nameHint: user.name,
  });

  revalidatePath("/connect");
  revalidatePath(`/f/${profile.slug}`);
  return ok(
    { publicPath: `/f/${profile.slug}` },
    "Freelancer profile saved."
  );
}

export async function createGigAction(
  _prev: ActionResult<{ gigId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ gigId: string }>> {
  const user = await requireUser();
  const parsed = gigPostingSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    skillNeeded: formString(formData, "skillNeeded") || undefined,
    category: formString(formData, "category") || undefined,
    location: formString(formData, "location") || undefined,
    budget: formString(formData, "budget") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Please fix the highlighted fields.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  try {
    const gig = await createGigRequest({
      userId: user.id,
      data: parsed.data,
    });
    revalidatePath("/connect");
    return ok({ gigId: gig.id }, "Gig posted.");
  } catch (error) {
    return fail(
      "BUSINESS_REQUIRED",
      error instanceof Error
        ? error.message
        : "List a business first before posting a gig."
    );
  }
}
