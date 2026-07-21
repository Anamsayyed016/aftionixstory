import Link from "next/link";
import { ArrowRight, BookOpenText, Check, PenLine, Sparkles, Users } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { StoryStatusBadge } from "@/components/app/story-badges";

const templates = [
  { name: "Blank project", detail: "Start with a clean canvas", type: "Custom" },
  { name: "Novel", detail: "Plan a long-form narrative", type: "Novel" },
  { name: "Screenplay", detail: "Shape a scene-led script", type: "Screenplay" },
  { name: "Web series", detail: "Build an episodic world", type: "Web Series" },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats(user.id);
  const firstName = user.name?.split(" ")[0] || "Writer";
  const currentProject = stats.recentStories[0];
  const goalProgress = Math.min(100, Math.round((stats.monthlyGenerations / Math.max(1, stats.generationLimit)) * 100));

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-violet">AFTIONIX Studio</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Good to see you, {firstName}.</h2>
          <p className="mt-3 text-base leading-relaxed text-ink-dim">Your next page is waiting. Pick up a project or begin with a fresh idea.</p>
        </div>
        <Link href="/create">
          <Button size="lg"><PenLine className="h-4 w-4" />New project</Button>
        </Link>
      </section>

      {currentProject ? (
        <section aria-labelledby="continue-writing">
          <GlassCard manuscript hover className="overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p id="continue-writing" className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-violet">Continue writing</p>
                <div className="mt-4 flex flex-wrap items-center gap-2"><StoryStatusBadge status={currentProject.status} /><Badge variant="outline">{currentProject.genre}</Badge></div>
                <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">{currentProject.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-dim">{currentProject.description || "Return to your workspace, shape the next moment, and let the story move forward."}</p>
                <p className="mt-5 font-mono text-[11px] text-ink-faint">{currentProject._count.characters} characters · updated {currentProject.updatedAt.toLocaleDateString()}</p>
              </div>
              <Link href={`/stories/${currentProject.id}`}><Button size="lg">Open workspace<ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </GlassCard>
        </section>
      ) : (
        <EmptyState icon={PenLine} title="Your studio is ready" description="Start a project with a premise, a character, or a blank page. AFTIONIX will help you build from there." actionHref="/create" actionLabel="Create your first project" />
      )}

      <section className="grid gap-8 lg:grid-cols-[1.45fr_0.85fr]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Start with a shape</p><h3 className="mt-1 font-display text-2xl font-semibold text-ink">Project templates</h3></div><Link href="/create" className="text-sm font-medium text-violet hover:underline">Browse all</Link></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => <Link key={template.name} href={`/create?type=${encodeURIComponent(template.type)}`}><GlassCard hover className="h-full p-5"><BookOpenText className="h-5 w-5 text-violet" aria-hidden /><h4 className="mt-5 font-display text-xl font-semibold text-ink">{template.name}</h4><p className="mt-1 text-sm text-ink-dim">{template.detail}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-violet">Use template <ArrowRight className="h-3.5 w-3.5" /></span></GlassCard></Link>)}
          </div>
        </div>
        <div className="space-y-4">
          <GlassCard className="p-5"><div className="flex items-center justify-between"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Writing rhythm</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">This month</h3></div><Sparkles className="h-5 w-5 text-violet" aria-hidden /></div><div className="mt-6 flex items-end justify-between"><p className="font-display text-4xl text-ink">{stats.monthlyGenerations}<span className="text-lg text-ink-faint">/{stats.generationLimit}</span></p><p className="text-sm text-ink-dim">AI sessions</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-charcoal"><div className="h-full rounded-full bg-violet transition-[width] duration-500" style={{ width: `${goalProgress}%` }} /></div><p className="mt-3 text-sm text-ink-dim">Your creative context is ready whenever you are.</p></GlassCard>
          <GlassCard className="p-5"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-violet" aria-hidden /><h3 className="font-display text-xl font-semibold text-ink">Recent characters</h3></div>{stats.recentCharacters.length ? <ul className="mt-4 space-y-3">{stats.recentCharacters.map((character) => <li key={character.id}><Link href={`/stories/${character.storyId}/characters`} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-charcoal"><span><span className="block text-sm font-medium text-ink">{character.name}</span><span className="block text-xs text-ink-faint">{character.role || "Character"}</span></span><ArrowRight className="h-4 w-4 text-ink-faint" /></Link></li>)}</ul> : <p className="mt-4 text-sm leading-relaxed text-ink-dim">Create a project with characters to keep its cast close at hand.</p>}</GlassCard>
        </div>
      </section>

      <section className="border-t border-border pt-8"><div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-ink-dim"><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />{stats.totalStories} projects in your studio</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />{stats.totalCharacters} characters in context</span><span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />{stats.activeWritingRules} active writing rules</span></div></section>
    </div>
  );
}
