import { notFound } from "next/navigation";
import { BusinessProfileForm } from "@/components/app/marketplace/business-profile-form";
import { FreelancerProfileForm } from "@/components/app/marketplace/freelancer-profile-form";
import { GigPostingForm } from "@/components/app/marketplace/gig-posting-form";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

export default function MarketplaceFormsPreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MARKETPLACE_PREVIEW !== "1"
  ) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-void py-10 text-ink">
      <Container className="max-w-2xl space-y-12">
        <div>
          <Badge variant="success" dot>
            Forms preview
          </Badge>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            Marketplace structured forms
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Same schema as chat — Story Wizard field styling. Submit is live
            only when signed in on /connect/*.
          </p>
        </div>

        <section data-testid="form-business">
          <h2 className="mb-4 font-display text-xl font-semibold">
            Business profile
          </h2>
          <BusinessProfileForm
            defaults={{
              name: "Hoor Studio",
              category: "software developer",
              location: "Banswara",
              contactEmail: "anamsayyed58@gmail.com",
              summary: "Custom software and branding for local businesses.",
            }}
          />
        </section>

        <section data-testid="form-freelancer">
          <h2 className="mb-4 font-display text-xl font-semibold">
            Freelancer profile
          </h2>
          <FreelancerProfileForm
            defaults={{
              summary: "Logo and brand designer for cafés and shops.",
              skills: ["logo design", "branding"],
              location: "remote",
              availability: "Weekdays",
              portfolioLinks: ["https://portfolio.example/maya"],
            }}
          />
        </section>

        <section data-testid="form-gig">
          <h2 className="mb-4 font-display text-xl font-semibold">
            Gig posting
          </h2>
          <GigPostingForm hasBusiness />
        </section>
      </Container>
    </div>
  );
}
