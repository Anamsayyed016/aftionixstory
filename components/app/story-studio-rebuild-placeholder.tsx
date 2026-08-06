import Link from "next/link";
import { ArrowRight, Library, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

type StoryStudioRebuildPlaceholderProps = {
  /** Short label for which surface the user opened (e.g. "Chat Assistant"). */
  surface?: string;
};

/**
 * Interim UI while Story Studio / chat shells are removed ahead of rebuild.
 * Keeps routes alive, points users at live products + Settings (billing).
 */
export function StoryStudioRebuildPlaceholder({
  surface = "Story Studio",
}: StoryStudioRebuildPlaceholderProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 py-8">
      <GlassCard className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet/12 text-violet-soft">
            <Library className="h-5 w-5" />
          </span>
          <Badge variant="outline">Updating</Badge>
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
            {surface}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Story Studio is being rebuilt
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-dim">
            The writing UI is temporarily offline while we redesign it. Your
            stories, episodes, and subscription are unchanged — plans and
            generation limits still apply from Settings. Directory, Connect,
            and the rest of AFTIONIX Studio remain available.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href="/home">
            <Button className="w-full sm:w-auto">
              Back to Home
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="secondary" className="w-full sm:w-auto">
              <Settings className="h-4 w-4" />
              Plans &amp; billing
            </Button>
          </Link>
          <Link href="/studio">
            <Button variant="secondary" className="w-full sm:w-auto">
              Studio overview
            </Button>
          </Link>
        </div>

        <p className="text-xs text-ink-faint">
          Still available now:{" "}
          <Link href="/directory" className="text-lilac hover:underline">
            Business Directory
          </Link>
          {" · "}
          <Link href="/connect" className="text-lilac hover:underline">
            Freelancer Connect
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
