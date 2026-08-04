import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronDown, MapPin, Search } from "lucide-react";

import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { Container } from "@/components/ui/container";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import {
  DIRECTORY_CATEGORIES,
  matchDirectoryCategory,
  normalizeCityQuery,
} from "@/lib/marketplace/directory";

export const metadata: Metadata = {
  title: "Business Directory — AFTIONIX",
  description:
    "Browse verified local businesses by city on AFTIONIX.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string | string[];
  category?: string | string[];
  city?: string | string[];
}>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const categoryParam = first(params.category).trim();
  const city = normalizeCityQuery(first(params.city));
  const activeCategory = DIRECTORY_CATEGORIES.find(
    (c) => c.id === categoryParam
  );

  const businesses = await prisma.business.findMany({
    where: {
      verifiedAt: { not: null },
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { location: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        city
          ? { location: { contains: city, mode: "insensitive" } }
          : {},
      ],
    },
    orderBy: [{ verifiedAt: "desc" }, { name: "asc" }],
    take: 80,
    select: {
      id: true,
      name: true,
      slug: true,
      summary: true,
      category: true,
      location: true,
      verifiedAt: true,
    },
  });

  const filtered = (
    activeCategory
      ? businesses.filter((b) =>
          matchDirectoryCategory(b.category, activeCategory)
        )
      : businesses
  ).slice(0, 60);

  const cityEmpty = Boolean(city) && filtered.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border py-10 sm:py-14">
          <Container>
            <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
              Directory
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Browse by city
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-dim">
              Enter a city to find verified local businesses. No ratings or map
              distances yet — only what merchants publish.
            </p>

            <form method="get" className="mt-8 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    City
                  </span>
                  <div className="relative mt-1.5">
                    <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                    <input
                      name="city"
                      defaultValue={city}
                      placeholder="e.g. Pune"
                      autoComplete="address-level2"
                      className="w-full rounded-md border border-border bg-panel py-2.5 pr-3 pl-10 text-sm text-ink outline-none focus:border-violet"
                    />
                  </div>
                </label>
                {activeCategory ? (
                  <input
                    type="hidden"
                    name="category"
                    value={activeCategory.id}
                  />
                ) : null}
                <Button type="submit" size="md" className="sm:shrink-0">
                  Browse
                </Button>
              </div>

              <details className="group" open={q ? true : undefined}>
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm text-ink-dim hover:text-ink [&::-webkit-details-marker]:hidden">
                  <Search className="h-3.5 w-3.5" />
                  <span>Filter by keyword</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <label className="mt-3 block max-w-md">
                  <span className="sr-only">Keyword search</span>
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Name, category, or keyword"
                    className="w-full rounded-md border border-border bg-panel px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
                  />
                </label>
              </details>
            </form>
          </Container>
        </section>

        <section className="py-8 sm:py-10">
          <Container>
            <h2 className="font-display text-lg font-semibold text-ink">
              Categories
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <CategoryChip
                href={buildDirectoryHref({ q, city })}
                label="All"
                active={!activeCategory}
              />
              {DIRECTORY_CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  href={buildDirectoryHref({
                    q,
                    city,
                    category: cat.id,
                  })}
                  label={cat.label}
                  active={activeCategory?.id === cat.id}
                />
              ))}
            </div>
          </Container>
        </section>

        <section className="border-t border-border py-10 sm:py-12">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  {city ? `Listings in ${city}` : "Verified businesses"}
                </h2>
                <p className="mt-1 text-sm text-ink-dim">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                  {activeCategory ? ` · ${activeCategory.label}` : ""}
                  {q ? ` · “${q}”` : ""}
                </p>
              </div>
              <Link
                href="/connect/business"
                className="text-sm text-lilac hover:underline"
              >
                List your business
              </Link>
            </div>

            {filtered.length === 0 ? (
              <GlassCard className="mt-8 p-8 text-center">
                {cityEmpty ? (
                  <>
                    <p className="text-sm text-ink-dim">
                      No businesses in {city} yet — be the first to list yours
                    </p>
                    <Link
                      href="/connect/business"
                      className="mt-4 inline-flex rounded-md bg-violet px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      List your business
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-ink-dim">
                    No verified businesses match yet. Try another city or
                    category, or{" "}
                    <Link
                      href="/connect/business"
                      className="text-lilac hover:underline"
                    >
                      list yours
                    </Link>
                    .
                  </p>
                )}
              </GlassCard>
            ) : (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((b) => (
                  <li key={b.id}>
                    <Link href={`/b/${b.slug}`} className="block h-full">
                      <GlassCard hover className="flex h-full flex-col p-5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <Badge variant="success" dot>
                            Verified
                          </Badge>
                        </div>
                        <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                          {b.name}
                        </h3>
                        {b.category ? (
                          <p className="mt-1 text-xs font-medium text-violet-soft">
                            {b.category}
                          </p>
                        ) : null}
                        {b.location ? (
                          <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-dim">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {b.location}
                          </p>
                        ) : null}
                        {b.summary ? (
                          <p className="mt-2 line-clamp-2 text-sm text-ink-faint">
                            {b.summary}
                          </p>
                        ) : null}
                      </GlassCard>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function buildDirectoryHref(opts: {
  q?: string;
  city?: string;
  category?: string;
}) {
  const sp = new URLSearchParams();
  if (opts.q) sp.set("q", opts.q);
  if (opts.city) sp.set("city", opts.city);
  if (opts.category) sp.set("category", opts.category);
  const s = sp.toString();
  return s ? `/directory?${s}` : "/directory";
}

function CategoryChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-violet px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-md border border-border bg-panel px-3 py-1.5 text-sm text-ink-dim hover:border-violet/40 hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}
