import { notFound } from "next/navigation";
import {
  LayoutGrid,
  Building2,
  Handshake,
  Settings,
} from "lucide-react";

import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

/**
 * Visual proof: slim authenticated nav (Home / Directory / Connect / Settings).
 */
export default function SlimNavPreviewPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MARKETPLACE_PREVIEW !== "1"
  ) {
    notFound();
  }

  const desktop = [
    { label: "Home", icon: LayoutGrid, active: true },
    { label: "Directory", icon: Building2 },
    { label: "Connect", icon: Handshake },
    { label: "Settings", icon: Settings },
  ] as const;

  const mobile = desktop;

  return (
    <div className="min-h-screen bg-void py-10 text-ink">
      <Container className="max-w-4xl space-y-8">
        <div>
          <Badge variant="success" dot>
            Simplified
          </Badge>
          <h1 className="mt-3 font-display text-2xl font-semibold">
            Authenticated surface — /home hub
          </h1>
          <p className="mt-2 text-sm text-ink-dim">
            Sidebar and mobile tabs: Home, Directory, Connect, Settings. Story
            Studio placeholders redirect to /home. Admin is URL-only.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside
            className="rounded-xl border border-border bg-charcoal/80 p-3"
            data-testid="slim-sidebar"
          >
            <p className="mb-3 px-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Sidebar
            </p>
            <nav className="flex flex-col gap-1">
              {desktop.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                      "active" in item && item.active
                        ? "bg-panel-raised text-ink"
                        : "text-ink-dim"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                );
              })}
            </nav>
            <p className="mt-4 px-3 font-mono text-[10px] text-ink-faint">
              Admin hidden · Log out only
            </p>
          </aside>

          <div className="space-y-4 rounded-xl border border-border bg-panel/40 p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
              Home
            </p>
            <h2 className="font-display text-2xl font-semibold">
              What do you want to do?
            </h2>
            <p className="text-sm text-ink-dim">
              Directory and Connect are live. Story Studio is being rebuilt.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {["Directory", "Connect", "Settings"].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-border bg-panel-raised p-4 text-sm"
                >
                  <Badge variant="success" dot>
                    Live
                  </Badge>
                  <p className="mt-2 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <nav
          className="mx-auto flex h-14 max-w-lg items-stretch justify-around rounded-xl border border-border bg-charcoal/95 px-2"
          data-testid="slim-mobile-nav"
        >
          {mobile.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  "active" in item && item.active ? "text-lilac" : "text-ink-faint"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
            );
          })}
        </nav>
      </Container>
    </div>
  );
}
