import { notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { GoogleBusinessProfileNudge } from "@/components/app/marketplace/google-business-profile-nudge";

/**
 * Visual proof of the Google Maps assist chat chip + listing card.
 * Enabled when MARKETPLACE_PREVIEW=1 (same as other marketplace previews).
 */
export default function GbpNudgePreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MARKETPLACE_PREVIEW !== "1"
  ) {
    notFound();
  }

  const suggestions = [
    "Help me list on Google Maps",
    "View listing",
    "Post a gig",
  ];

  return (
    <div className="min-h-screen bg-void py-10 text-ink">
      <Container className="max-w-2xl space-y-8">
        <div>
          <Badge variant="success" dot>
            Preview
          </Badge>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            Google Maps assist — chat + listing card
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            First-verification chat reply, suggestion chip, and the owner
            GlassCard that appears on /b/[slug]?gbp=1.
          </p>
        </div>

        <section
          className="space-y-3 rounded-xl border border-border bg-panel/40 p-5"
          data-testid="gbp-chat-preview"
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            assistant
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink-dim">
            Your business **Bright Print Co** is live at /b/bright-print-co.
            Owner-chosen contact is shown on that page (shopfront model). You
            can post a gig anytime — e.g. “I need a logo designed.” Want Google
            Maps too? Tap “Help me list on Google Maps” — we’ll help you copy
            your details (Google’s signup is separate; we don’t create the Maps
            listing for you).
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-ink-dim"
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section data-testid="gbp-card-preview">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            /b/bright-print-co?gbp=1
          </p>
          <GoogleBusinessProfileNudge
            businessId="preview-bright-print"
            business={{
              name: "Bright Print Co",
              category: "Printing & branding",
              location: "Pune",
              contactPhone: "+91 98765 43210",
              contactEmail: "demo-business@aftionix.example",
            }}
          />
        </section>
      </Container>
    </div>
  );
}
