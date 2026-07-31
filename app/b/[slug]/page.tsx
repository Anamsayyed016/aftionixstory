import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, MapPin, Mail, Phone } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { name: true, summary: true, category: true, location: true },
  });
  if (!business) return { title: "Business not found" };
  const description =
    business.summary?.slice(0, 160) ||
    `${business.name}${business.category ? ` · ${business.category}` : ""}${
      business.location ? ` · ${business.location}` : ""
    }`;
  return {
    title: `${business.name} · AFTIONIX Directory`,
    description,
    openGraph: {
      title: business.name,
      description,
      type: "profile",
    },
  };
}

export default async function BusinessPublicPage({ params }: Props) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      gigs: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
  if (!business) notFound();

  return (
    <div className="min-h-screen bg-void text-ink">
      <header className="border-b border-border">
        <Container className="flex h-14 items-center justify-between">
          <Link href="/" className="font-display text-sm font-semibold">
            AFTIONIX Directory
          </Link>
          <Link
            href="/sign-up"
            className="text-sm text-violet-soft hover:underline"
          >
            Get Started
          </Link>
        </Container>
      </header>

      <Container className="py-12 sm:py-16">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet/12 text-violet-soft">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <Badge variant="success" dot>
              Business
            </Badge>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {business.name}
            </h1>
            {business.category ? (
              <p className="mt-1 text-sm text-ink-dim">{business.category}</p>
            ) : null}
          </div>
        </div>

        {business.summary ? (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
            {business.summary}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-ink-dim">
          {business.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-ink-faint" />
              {business.location}
            </span>
          ) : null}
          {business.contactEmail ? (
            <a
              href={`mailto:${business.contactEmail}`}
              className="inline-flex items-center gap-1.5 hover:text-ink"
            >
              <Mail className="h-4 w-4 text-ink-faint" />
              {business.contactEmail}
            </a>
          ) : null}
          {business.contactPhone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-ink-faint" />
              {business.contactPhone}
            </span>
          ) : null}
        </div>

        {business.gigs.length > 0 ? (
          <section className="mt-14">
            <h2 className="font-display text-xl font-semibold">Open gigs</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Connect through AFTIONIX chat — contact for freelancers is revealed
              only after mutual interest.
            </p>
            <ul className="mt-6 space-y-4">
              {business.gigs.map((gig) => (
                <li
                  key={gig.id}
                  className="rounded-xl border border-border bg-panel/40 p-5"
                >
                  <h3 className="font-medium text-ink">{gig.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                    {gig.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-faint">
                    {gig.skillNeeded ? (
                      <span>Skill: {gig.skillNeeded}</span>
                    ) : null}
                    {gig.location ? <span>· {gig.location}</span> : null}
                    {gig.budget ? <span>· Budget: {gig.budget}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
