import { notFound } from "next/navigation";

import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

/**
 * Visual proof: meta listing starter asks for real details (no junk save).
 */
export default function BusinessMetaStarterPreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MARKETPLACE_PREVIEW !== "1"
  ) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-void py-10 text-ink">
      <Container className="max-w-2xl space-y-6">
        <div>
          <Badge variant="success" dot>
            Fixed
          </Badge>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            Business listing — meta starter no longer saves junk
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            The studio prompt “List my business on the directory. I&apos;ll
            share…” must ask for real details, not create a broken Business.
          </p>
        </div>

        <div
          className="space-y-3 rounded-xl border border-border bg-panel/40 p-5"
          data-testid="meta-starter-flow"
        >
          <div className="ml-8 rounded-2xl rounded-br-md bg-violet/12 px-4 py-2.5 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              user
            </p>
            <p className="mt-1">
              List my business on the directory. I&apos;ll share the name, what
              we do, location, and contact email.
            </p>
          </div>
          <div className="mr-8 rounded-2xl rounded-bl-md border border-border bg-panel-raised px-4 py-2.5 text-sm text-ink-dim">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              assistant
            </p>
            <p className="mt-1" data-testid="meta-starter-reply">
              I can list your business on the directory. Tell me the business
              name, what you do, where you&apos;re based, and a contact email
              (phone optional).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-panel px-3 py-1.5 text-xs">
                Example listing
              </span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
