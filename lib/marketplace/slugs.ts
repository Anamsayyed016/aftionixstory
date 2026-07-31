import "server-only";

import { prisma } from "@/lib/db";
import { slugifyTitle, withSlugSuffix } from "@/lib/utils/slug";

export async function allocateBusinessSlug(
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugifyTitle(name) || "business";
  let n = 1;
  while (n < 1000) {
    const candidate = withSlugSuffix(base, n);
    const existing = await prisma.business.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
  }
  return `${base}-${Date.now()}`;
}

export async function allocateFreelancerSlug(
  nameHint: string,
  excludeId?: string
): Promise<string> {
  const base = slugifyTitle(nameHint) || "freelancer";
  let n = 1;
  while (n < 1000) {
    const candidate = withSlugSuffix(base, n);
    const existing = await prisma.freelancerProfile.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
  }
  return `${base}-${Date.now()}`;
}
