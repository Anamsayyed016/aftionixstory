import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { GigPostingForm } from "@/components/app/marketplace/gig-posting-form";
import { BackLink } from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export default async function GigFormPage() {
  const user = await requireUser();
  const business = await prisma.business.findFirst({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto pb-8">
      <BackLink href="/connect">Back to Connect</BackLink>
      <div>
        <p className="text-xs text-violet-soft">Freelancer Connect</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Post a gig
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Describe the task — connect-only, no payments in v1. Chat-assisted
          posting is paused while Story Studio is rebuilt.
        </p>
      </div>
      <GigPostingForm hasBusiness={Boolean(business)} />
    </div>
  );
}
