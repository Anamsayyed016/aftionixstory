import { prisma } from "@/lib/db";
import {
  absoluteUrl,
  isGigPastValidThrough,
} from "@/lib/marketplace/job-posting";

export const dynamic = "force-dynamic";

type SitemapEntry = {
  url: string;
  lastModified?: Date | string;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(date: Date | string | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function renderUrlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const bits = [`<loc>${escapeXml(entry.url)}</loc>`];
      const lastmod = toIso(entry.lastModified);
      if (lastmod) bits.push(`<lastmod>${lastmod}</lastmod>`);
      if (entry.changeFrequency) {
        bits.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
      }
      if (typeof entry.priority === "number") {
        bits.push(`<priority>${entry.priority}</priority>`);
      }
      return `<url>\n${bits.join("\n")}\n</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function staticEntries(now: Date): SitemapEntry[] {
  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/studio"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/directory"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/sign-in"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/sign-up"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

async function buildEntries(): Promise<SitemapEntry[]> {
  const now = new Date();
  const gigCreatedAfter = new Date(now.getTime());
  gigCreatedAfter.setUTCDate(gigCreatedAfter.getUTCDate() - 60);

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
    ...staticEntries(now),
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

function xmlResponse(xml: string, status = 200): Response {
  return new Response(xml, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Avoid intermediary caches retaining a bad/error HTML response.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

/**
 * Explicit route handler (instead of app/sitemap.ts) so DB/upstream failures
 * never fall through to Next's HTML error page — Google rejects that as
 * "Sitemap appears to be an HTML page."
 */
export async function GET() {
  try {
    const entries = await buildEntries();
    return xmlResponse(renderUrlset(entries));
  } catch (err) {
    console.error("[sitemap.xml] failed; serving static fallback", err);
    return xmlResponse(renderUrlset(staticEntries(new Date())));
  }
}
