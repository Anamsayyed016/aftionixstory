import Link from "next/link";
import {
  Library,
  Building2,
  Handshake,
  ArrowRight,
  Settings,
} from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LIVE = [
  {
    id: "directory",
    title: "Business Directory",
    description: "Browse and search public business listings.",
    href: "/directory",
    icon: Building2,
  },
  {
    id: "connect",
    title: "Freelancer Connect",
    description: "Post gigs or list skills — mutual match unlocks contact.",
    href: "/connect",
    icon: Handshake,
  },
  {
    id: "settings",
    title: "Plans & billing",
    description: "Manage your subscription and generation limits.",
    href: "/settings",
    icon: Settings,
  },
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto pb-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
          Home
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          What do you want to do?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Directory and Connect are live. Story Studio is being rebuilt —
          plans and billing stay in Settings.
        </p>
      </div>

      <GlassCard className="flex flex-col gap-4 border-border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
            <Library className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-semibold text-ink">
                Story Studio
              </h3>
              <Badge variant="outline">Updating</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-dim">
              Writing UI is temporarily offline. Your stories and subscription
              are unchanged.
            </p>
          </div>
        </div>
        <Link href="/studio">
          <Button variant="secondary" className="w-full sm:w-auto">
            Overview
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {LIVE.map((product) => {
          const Icon = product.icon;
          return (
            <GlassCard key={product.id} hover className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
                  <Icon className="h-4 w-4" />
                </span>
                <Badge variant="success" dot>
                  Live
                </Badge>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                {product.title}
              </h3>
              <p className="mt-1 flex-1 text-sm text-ink-dim">
                {product.description}
              </p>
              <Link href={product.href} className="mt-4">
                <Button variant="secondary" className="w-full">
                  Open
                </Button>
              </Link>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
