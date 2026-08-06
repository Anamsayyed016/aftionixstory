import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { BusinessProfileForm } from "@/components/app/marketplace/business-profile-form";
import { BackLink } from "@/components/ui/back-link";

export const dynamic = "force-dynamic";

export default async function BusinessFormPage() {
  const user = await requireUser();
  const existing = await prisma.business.findFirst({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto pb-8">
      <BackLink href="/connect">Back to Connect</BackLink>
      <div>
        <p className="text-xs text-violet-soft">Business Directory</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          {existing ? "Edit business listing" : "List your business"}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-ink-dim">
          Use this form to list or update your business. Chat-assisted setup is
          paused while Story Studio is rebuilt.
        </p>
      </div>
      <BusinessProfileForm
        defaults={
          existing
            ? {
                name: existing.name,
                category: existing.category || undefined,
                location: existing.location || undefined,
                contactEmail: existing.contactEmail || undefined,
                contactPhone: existing.contactPhone || undefined,
                summary: existing.summary || undefined,
              }
            : { contactEmail: user.email || undefined }
        }
      />
    </div>
  );
}
