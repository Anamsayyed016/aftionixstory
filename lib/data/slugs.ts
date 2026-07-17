import "server-only";

import { prisma } from "@/lib/db";
import { slugifyTitle, withSlugSuffix } from "@/lib/utils/slug";

export async function allocateUniqueSlug(
  userId: string,
  title: string,
  excludeStoryId?: string
): Promise<string> {
  const base = slugifyTitle(title);
  let n = 1;

  while (n < 1000) {
    const candidate = withSlugSuffix(base, n);
    const existing = await prisma.story.findFirst({
      where: {
        userId,
        slug: candidate,
        ...(excludeStoryId ? { NOT: { id: excludeStoryId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
  }

  return `${base}-${Date.now()}`;
}
