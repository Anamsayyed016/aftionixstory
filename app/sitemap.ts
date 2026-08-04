import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import {
  absoluteUrl,
  isGigPastValidThrough,
} from "@/lib/marketplace/job-posting";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // Only include gigs still within the 60-day JobPosting window.
  const gigCreatedAfter = new Date(now.getTime());
  gigCreatedAfter.setUTCDate(gigCreatedAfter.getUTCDate() - 60);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/studio"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/sign-in"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/sign-up"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [businesses, freelancers, openGigs] = await Promise.all([
    prisma.business.findMany({
      where: { verifiedAt: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.freelancerProfile.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.gigRequest.findMany({
      where: {
        status: "OPEN",
        createdAt: { gte: gigCreatedAfter },
        business: { verifiedAt: { not: null } },
      },
      select: { id: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
  ]);

  const indexableGigs = openGigs.filter(
    (g) => !isGigPastValidThrough(g.createdAt, now)
  );

  return [
    ...staticEntries,
    ...businesses.map((b) => ({
      url: absoluteUrl(`/b/${b.slug}`),
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...freelancers.map((f) => ({
      url: absoluteUrl(`/f/${f.slug}`),
      lastModified: f.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...indexableGigs.map((g) => ({
      url: absoluteUrl(`/g/${g.id}`),
      lastModified: g.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
  ];
}
