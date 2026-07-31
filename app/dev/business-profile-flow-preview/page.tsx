import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

/**
 * Visual proof of the fixed multi-turn business profile flow.
 * Enabled when MARKETPLACE_PREVIEW=1 (same as other marketplace previews).
 */
export default function BusinessProfileFlowPreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MARKETPLACE_PREVIEW !== "1"
  ) {
    notFound();
  }

  const turns = [
    {
      role: "user",
      text: "List my business on the directory",
    },
    {
      role: "assistant",
      text: "I can list your business on the directory. Tell me the business name, what you do, where you're based, and a contact email (phone optional).",
    },
    {
      role: "user",
      text: "software developer, hoor, anamsayyed58@gmail.com",
    },
    {
      role: "assistant",
      text: 'Saved **hoor** (name: hoor; category: software developer; email: anamsayyed58@gmail.com). Still need: location. Reply with just those — e.g. "location - Banswara".',
      note: "Previously looped here by re-asking for the business name",
    },
    {
      role: "user",
      text: "name - hoor, location- banswara",
    },
    {
      role: "assistant",
      text: "Your business **hoor** is live at /b/hoor. Owner-chosen contact is shown on that page (shopfront model).",
      note: "Completes — no name re-ask",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-void py-10 text-ink">
      <Container className="max-w-2xl space-y-6">
        <div>
          <Badge variant="success" dot>
            Fixed flow
          </Badge>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            Business profile chat — multi-turn
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Exact reported conversation after extraction + draft accumulation
            fix.
          </p>
        </div>

        <div
          className="space-y-3 rounded-xl border border-border bg-panel/40 p-5"
          data-testid="business-profile-flow"
        >
          {turns.map((t, i) => (
            <div
              key={i}
              className={
                t.role === "user"
                  ? "ml-8 rounded-2xl rounded-br-md bg-violet/12 px-4 py-2.5 text-sm"
                  : "mr-8 rounded-2xl rounded-bl-md border border-border bg-panel-raised px-4 py-2.5 text-sm text-ink-dim"
              }
              data-testid={`turn-${i}-${t.role}`}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                {t.role}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{t.text}</p>
              {"note" in t && t.note ? (
                <p className="mt-2 text-xs text-success">{t.note}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
