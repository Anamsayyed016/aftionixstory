import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, ExternalLink } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { publicFreelancerViewContact } from "@/lib/freelance-agent/contact-reveal";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await prisma.freelancerProfile.findUnique({
    where: { slug },
    select: { summary: true, skills: true, location: true, slug: true },
  });
  if (!profile) return { title: "Freelancer not found" };
  const title = `Freelancer · ${profile.skills.slice(0, 2).join(", ") || profile.slug}`;
  const description =
    profile.summary?.slice(0, 160) ||
    `${profile.skills.join(", ")}${profile.location ? ` · ${profile.location}` : ""}`;
  return {
    title: `${title} · AFTIONIX Connect`,
    description,
    openGraph: { title, description, type: "profile" },
  };
}

export default async function FreelancerPublicPage({ params }: Props) {
  const { slug } = await params;
  const profile = await prisma.freelancerProfile.findUnique({
    where: { slug },
  });
  if (!profile) notFound();

  // Hard gate: public page never shows contact (even if DB has overrides).
  const contact = publicFreelancerViewContact();
  void contact;

  return (
    <div className="min-h-screen bg-void text-ink">
      <header className="border-b border-border">
        <Container className="flex h-14 items-center justify-between">
          <Link href="/" className="font-display text-sm font-semibold">
            AFTIONIX Freelancer Connect
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
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <Badge variant="violet" dot>
              Freelancer
            </Badge>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {profile.skills[0]
                ? `${profile.skills[0]} professional`
                : profile.slug}
            </h1>
            {profile.location ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-dim">
                <MapPin className="h-4 w-4" />
                {profile.location}
              </p>
            ) : null}
          </div>
        </div>

        {profile.summary ? (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
            {profile.summary}
          </p>
        ) : null}

        {profile.skills.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              Skills
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {profile.availability ? (
          <div className="mt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              Availability
            </h2>
            <p className="mt-2 text-sm text-ink-dim">{profile.availability}</p>
          </div>
        ) : null}

        {profile.portfolioLinks.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              Portfolio
            </h2>
            <ul className="mt-3 space-y-2">
              {profile.portfolioLinks.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-violet-soft hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-12 max-w-xl rounded-lg border border-dashed border-border px-4 py-3 text-sm text-ink-faint">
          Contact details are private. Express mutual interest on a gig through
          AFTIONIX chat to connect — no payments or escrow in v1.
        </p>
      </Container>
    </div>
  );
}
