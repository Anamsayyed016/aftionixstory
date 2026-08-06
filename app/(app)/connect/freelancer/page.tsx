import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { FreelancerProfileForm } from "@/components/app/marketplace/freelancer-profile-form";
import { BackLink } from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export default async function FreelancerFormPage() {
  const user = await requireUser();
  const existing = await prisma.freelancerProfile.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto pb-8">
      <BackLink href="/connect">Back to Connect</BackLink>
      <div>
        <p className="text-xs text-violet-soft">Freelancer Connect</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          {existing ? "Edit freelancer profile" : "Create freelancer profile"}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Public page shows skills — contact stays private until mutual match.
          Chat-assisted setup is paused while Story Studio is rebuilt.
        </p>
      </div>
      <FreelancerProfileForm
        defaults={
          existing
            ? {
                summary: existing.summary || undefined,
                skills: existing.skills,
                location: existing.location || undefined,
                availability: existing.availability || undefined,
                portfolioLinks: existing.portfolioLinks,
                contactEmail: existing.contactEmail || undefined,
                contactPhone: existing.contactPhone || undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
