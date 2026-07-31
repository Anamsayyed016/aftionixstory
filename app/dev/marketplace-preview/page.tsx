import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { revealContactsForMatch } from "@/lib/freelance-agent/contact-reveal";

/**
 * Deterministic UI states for screenshot / QA (disabled in production).
 */
export default function MarketplacePreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MARKETPLACE_PREVIEW !== "1"
  ) {
    notFound();
  }

  const business = {
    contactEmail: "hello@brightprint.example",
    contactPhone: "+91 98765 43210",
  };
  const freelancer = {
    contactEmail: "maya@designer.example",
    contactPhone: "+91 91234 56789",
    userEmail: "demo-freelancer@aftionix.example",
  };

  const states = ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"] as const;

  return (
    <div className="min-h-screen bg-void py-10 text-ink">
      <Container className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Marketplace preview (dev)
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Contact reveal states for screenshot verification.
          </p>
        </div>

        <section
          className="rounded-xl border border-border p-5"
          data-testid="preview-business-card"
        >
          <Badge variant="success" dot>
            Business created
          </Badge>
          <h2 className="mt-3 font-display text-xl font-semibold">
            Bright Print Co
          </h2>
          <p className="mt-2 text-sm text-ink-dim">
            Local printing and branding · Pune
          </p>
          <p className="mt-3 text-sm">
            Contact (shopfront): {business.contactEmail} ·{" "}
            {business.contactPhone}
          </p>
        </section>

        <section
          className="rounded-xl border border-border p-5"
          data-testid="preview-gig-card"
        >
          <Badge variant="violet">Gig posted</Badge>
          <h2 className="mt-3 font-display text-xl font-semibold">
            Logo design
          </h2>
          <p className="mt-2 text-sm text-ink-dim">
            Need a logo designed for packaging refresh. Budget ₹8,000–12,000 ·
            remote
          </p>
        </section>

        <section
          className="rounded-xl border border-border p-5"
          data-testid="preview-freelancer-card"
        >
          <Badge variant="violet" dot>
            Freelancer profile
          </Badge>
          <h2 className="mt-3 font-display text-xl font-semibold">
            logo design professional
          </h2>
          <p className="mt-2 text-sm text-ink-dim">
            Skills: logo design, branding · remote · Weekdays
          </p>
          <p className="mt-3 text-sm text-ink-faint">
            Public page: contact hidden
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {states.map((status) => {
            const revealed = revealContactsForMatch({
              status,
              business,
              freelancer,
            });
            return (
              <section
                key={status}
                className="rounded-xl border border-border p-5"
                data-testid={`preview-match-${status.toLowerCase()}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">Match · Logo design</span>
                  <Badge
                    variant={status === "ACCEPTED" ? "success" : "warning"}
                  >
                    {status}
                  </Badge>
                </div>
                {revealed.revealed ? (
                  <div
                    className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3 text-sm"
                    data-testid="contact-reveal"
                  >
                    <p className="font-mono text-[10px] uppercase text-success">
                      Contact revealed
                    </p>
                    <p className="mt-1">
                      Business: {revealed.business.email}
                    </p>
                    <p>Freelancer: {revealed.freelancer.email}</p>
                  </div>
                ) : (
                  <p
                    className="mt-3 text-sm text-ink-faint"
                    data-testid="contact-hidden"
                  >
                    Contact hidden — express interest → accept required.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
