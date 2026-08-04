import "server-only";

import { prisma } from "@/lib/db";
import { isBusinessPubliclyVisible } from "@/lib/marketplace/verification";

/**
 * Public gig page gate: OPEN + verified parent business.
 * Never select contact email/phone fields for the public surface.
 */
export async function loadPublicGig(id: string) {
  const gig = await prisma.gigRequest.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      skillNeeded: true,
      category: true,
      location: true,
      budget: true,
      status: true,
      createdAt: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          location: true,
          verifiedAt: true,
          category: true,
        },
      },
    },
  });

  if (!gig) return null;
  if (gig.status !== "OPEN") return null;
  if (!isBusinessPubliclyVisible(gig.business.verifiedAt)) return null;

  return gig;
}
