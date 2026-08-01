import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { prisma } from "@/lib/db";
import { revealContactsForMatch } from "@/lib/freelance-agent/contact-reveal";
import {
  acceptMatchAction,
  declineMatchAction,
  expressInterestInFreelancerAction,
  expressInterestInGigAction,
} from "@/app/actions/marketplace";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const [business, freelancer, matches, openGigs, freelancers] =
    await Promise.all([
      prisma.business.findFirst({
        where: { ownerUserId: userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.freelancerProfile.findUnique({ where: { userId } }),
      prisma.gigMatch.findMany({
        where: {
          OR: [
            { freelancerProfile: { userId } },
            { gig: { business: { ownerUserId: userId } } },
          ],
        },
        include: {
          gig: { include: { business: true } },
          freelancerProfile: {
            include: { user: { select: { email: true, name: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.gigRequest.findMany({
        where: { status: "OPEN" },
        include: { business: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.freelancerProfile.findMany({
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 overflow-y-auto pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Freelancer Connect
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Connect-only — no payments or escrow. Contact reveals only after both
            sides accept.
          </p>
        </div>
        <BackLink href="/dashboard">Back to Chat</BackLink>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-panel/40 p-5">
        <h2 className="font-display text-lg font-semibold">Your profiles</h2>
        <div className="mb-2 flex flex-wrap gap-3 text-sm">
          <Link href="/connect/business" className="text-violet-soft hover:underline">
            Business form
          </Link>
          <Link href="/connect/freelancer" className="text-violet-soft hover:underline">
            Freelancer form
          </Link>
          <Link href="/connect/gig" className="text-violet-soft hover:underline">
            Post a gig (form)
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-ink-faint">
              Business
            </p>
            {business ? (
              <>
                <p className="mt-1 font-medium">{business.name}</p>
                <Link
                  href={`/b/${business.slug}`}
                  className="mt-2 inline-block text-sm text-violet-soft hover:underline"
                >
                  /b/{business.slug}
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-dim">
                None yet —{" "}
                <Link href="/connect/business" className="text-violet-soft hover:underline">
                  use the form
                </Link>{" "}
                or chat: “List my business…”
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-ink-faint">
              Freelancer
            </p>
            {freelancer ? (
              <>
                <p className="mt-1 font-medium">
                  {freelancer.skills.slice(0, 3).join(", ") || freelancer.slug}
                </p>
                <Link
                  href={`/f/${freelancer.slug}`}
                  className="mt-2 inline-block text-sm text-violet-soft hover:underline"
                >
                  /f/{freelancer.slug}
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-dim">
                None yet —{" "}
                <Link href="/connect/freelancer" className="text-violet-soft hover:underline">
                  use the form
                </Link>{" "}
                or chat: “Find gig work…”
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Matches</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-ink-dim">No matches yet.</p>
        ) : (
          <ul className="space-y-4">
            {matches.map((m) => {
              const revealed = revealContactsForMatch({
                status: m.status,
                business: m.gig.business,
                freelancer: {
                  contactEmail: m.freelancerProfile.contactEmail,
                  contactPhone: m.freelancerProfile.contactPhone,
                  userEmail: m.freelancerProfile.user.email,
                },
              });
              const isBusinessOwner = m.gig.business.ownerUserId === userId;
              const canAccept =
                m.status === "PENDING" && m.initiatedByUserId !== userId;

              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-border bg-panel/40 p-5"
                  data-testid={`match-${m.status.toLowerCase()}`}
                  data-match-id={m.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.gig.title}</span>
                    <Badge
                      variant={
                        m.status === "ACCEPTED"
                          ? "success"
                          : m.status === "PENDING"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-dim">
                    {m.gig.business.name} ↔ /f/{m.freelancerProfile.slug}
                  </p>

                  {revealed.revealed ? (
                    <div
                      className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3 text-sm"
                      data-testid="contact-reveal"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-wider text-success">
                        Contact revealed
                      </p>
                      {isBusinessOwner ? (
                        <p className="mt-1">
                          Freelancer: {revealed.freelancer.email || "—"}
                          {revealed.freelancer.phone
                            ? ` · ${revealed.freelancer.phone}`
                            : ""}
                        </p>
                      ) : (
                        <p className="mt-1">
                          Business: {revealed.business.email || "—"}
                          {revealed.business.phone
                            ? ` · ${revealed.business.phone}`
                            : ""}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p
                      className="mt-3 text-sm text-ink-faint"
                      data-testid="contact-hidden"
                    >
                      Contact hidden until both sides accept.
                    </p>
                  )}

                  {canAccept ? (
                    <div className="mt-4 flex gap-2">
                      <form action={acceptMatchAction}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <Button type="submit" size="sm">
                          Accept
                        </Button>
                      </form>
                      <form action={declineMatchAction}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          Decline
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {freelancer ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Open gigs</h2>
          <ul className="space-y-3">
            {openGigs.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{g.title}</p>
                  <p className="text-xs text-ink-faint">
                    {g.business.name}
                    {g.skillNeeded ? ` · ${g.skillNeeded}` : ""}
                  </p>
                </div>
                <form action={expressInterestInGigAction}>
                  <input type="hidden" name="gigId" value={g.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Express interest
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {business ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Freelancers</h2>
          <ul className="space-y-3">
            {freelancers.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div>
                  <Link
                    href={`/f/${f.slug}`}
                    className="font-medium hover:underline"
                  >
                    /f/{f.slug}
                  </Link>
                  <p className="text-xs text-ink-faint">
                    {f.skills.slice(0, 4).join(", ")}
                  </p>
                </div>
                <form action={expressInterestInFreelancerAction}>
                  <input type="hidden" name="freelancerSlug" value={f.slug} />
                  <Button type="submit" size="sm" variant="secondary">
                    Express interest
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
