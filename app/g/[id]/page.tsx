import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Building2 } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { loadPublicGig } from "@/lib/marketplace/public-gig";
import { buildGigJobPostingJsonLd } from "@/lib/marketplace/job-posting";
import { isSafeAppPath } from "@/lib/marketplace/schemas";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const gig = await loadPublicGig(id);
  if (!gig) {
    return {
      title: "Gig not found",
      robots: { index: false, follow: false },
    };
  }
  const description =
    gig.description.slice(0, 160) ||
    `${gig.title}${gig.location ? ` · ${gig.location}` : ""}`;
  return {
    title: `${gig.title} · AFTIONIX Gigs`,
    description,
    openGraph: {
      title: gig.title,
      description,
      type: "website",
    },
  };
}

export default async function PublicGigPage({ params }: Props) {
  const { id } = await params;
  const gig = await loadPublicGig(id);
  if (!gig) notFound();

  const jsonLd = buildGigJobPostingJsonLd(gig);
  const connectHref = "/connect";
  const signUpCallback = isSafeAppPath(`/g/${gig.id}`)
    ? `/sign-up?callbackUrl=${encodeURIComponent(`/g/${gig.id}`)}`
    : "/sign-up";

  return (
    <div className="min-h-screen bg-void text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border">
        <Container className="flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <BackLink href="/">Back to home</BackLink>
            <Link
              href="/studio"
              className="hidden font-display text-sm font-semibold sm:inline"
            >
              AFTIONIX Gigs
            </Link>
          </div>
          <Link
            href={signUpCallback}
            className="shrink-0 text-sm text-violet-soft hover:underline"
          >
            Get Started
          </Link>
        </Container>
      </header>

      <Container className="py-12 sm:py-16">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet/12 text-violet-soft">
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <Badge variant="success" dot>
              Open gig
            </Badge>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {gig.title}
            </h1>
            <p className="mt-2 text-sm text-ink-dim">
              Hired by{" "}
              <Link
                href={`/b/${gig.business.slug}`}
                className="inline-flex items-center gap-1 font-medium text-lilac hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                {gig.business.name}
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-relaxed text-ink-dim">
          {gig.description}
        </p>

        <div className="mt-8 flex flex-wrap gap-3 text-sm text-ink-dim">
          {gig.skillNeeded ? (
            <Badge variant="outline">Skill: {gig.skillNeeded}</Badge>
          ) : null}
          {gig.category ? (
            <Badge variant="outline">{gig.category}</Badge>
          ) : null}
          {(gig.location || gig.business.location) ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-ink-faint" />
              {gig.location || gig.business.location}
            </span>
          ) : null}
          {gig.budget ? (
            <span className="text-ink-faint">Budget: {gig.budget}</span>
          ) : null}
        </div>

        <div className="mt-12 max-w-xl space-y-4 rounded-xl border border-border bg-panel/40 p-6">
          <h2 className="font-display text-lg font-semibold">
            Interested in this gig?
          </h2>
          <p className="text-sm text-ink-dim">
            Contact stays private until both sides accept on Freelancer Connect.
            No payments or escrow in v1.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={signUpCallback}
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              Sign up to connect
            </Link>
            <Link
              href={connectHref}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Open Connect
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
