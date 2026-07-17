import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, Lock, Users } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getOwnedStoryDetail } from "@/lib/data/stories";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  StoryStatusBadge,
  StoryVisibilityBadge,
} from "@/components/app/story-badges";

export default async function StoryWorkspacePage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const user = await requireUser();
  const { storyId } = await params;
  const story = await getOwnedStoryDetail(user.id, storyId);
  if (!story) notFound();

  const activeCharacters = story.characters.filter((c) => c.status === "ACTIVE");
  const activeRules = story.writingRules.filter((r) => r.isActive);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StoryStatusBadge status={story.status} />
            <StoryVisibilityBadge visibility={story.visibility} />
            <Badge variant="outline">{story.genre}</Badge>
          </div>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {story.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-dim">
            {story.description || "No description yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/stories/${story.id}/edit`}>
            <Button variant="secondary">Edit story</Button>
          </Link>
          <Link href={`/stories/${story.id}/characters`}>
            <Button variant="secondary">
              <Users className="h-4 w-4" />
              Characters
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
        <GlassCard className="space-y-4 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Episodes
          </p>
          <div className="rounded-md border border-dashed border-border bg-charcoal/40 p-4 text-sm text-ink-dim">
            No episodes yet. AI episode generation will be added in the next
            phase.
          </div>
          <p className="font-mono text-[10px] text-ink-faint">
            Total episodes: {story.totalEpisodes}
          </p>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="space-y-4 p-5">
            <h3 className="font-display text-xl font-semibold text-ink">Overview</h3>
            <Meta label="Setting" value={story.setting} />
            <Meta label="Time period" value={story.timePeriod} />
            <Meta label="Main conflict" value={story.mainConflict} />
            <Meta label="Initial plot" value={story.initialPlot} />
            <Meta label="World rules" value={story.worldRules} />
            <Meta label="Content boundaries" value={story.contentBoundaries} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Meta label="Writing style" value={story.writingStyle} />
              <Meta label="POV" value={story.pointOfView} />
              <Meta label="Pacing" value={story.pacing} />
              <Meta label="Episode length" value={story.episodeLength} />
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 text-ink-faint">
              <Lock className="h-4 w-4" />
              <h3 className="font-display text-lg font-semibold text-ink">
                Story composer
              </h3>
            </div>
            <textarea
              disabled
              rows={5}
              className="mt-4 w-full cursor-not-allowed rounded-md border border-border bg-charcoal/50 px-3 py-2 text-sm text-ink-faint"
              placeholder="Describe what should happen in the next episode..."
            />
            <p className="mt-3 text-sm text-ink-dim">
              AI generation is not connected yet.
            </p>
            <Button disabled className="mt-4" variant="secondary">
              Generate Episode
            </Button>
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Characters
              </p>
              <Link
                href={`/stories/${story.id}/characters`}
                className="text-xs text-lilac hover:underline"
              >
                Manage
              </Link>
            </div>
            <ul className="space-y-2">
              {activeCharacters.slice(0, 6).map((c) => (
                <li key={c.id} className="rounded-md bg-charcoal/50 px-3 py-2">
                  <p className="text-sm text-ink">{c.name}</p>
                  <p className="font-mono text-[10px] text-ink-faint">{c.role}</p>
                </li>
              ))}
              {activeCharacters.length === 0 && (
                <li className="text-sm text-ink-dim">No active characters.</li>
              )}
            </ul>
          </GlassCard>

          <GlassCard className="p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Relationships
            </p>
            <ul className="space-y-2 text-sm text-ink-dim">
              {story.relationships.slice(0, 5).map((r) => (
                <li key={r.id}>
                  {r.sourceCharacter.name} → {r.targetCharacter.name}
                  <span className="block font-mono text-[10px] text-ink-faint">
                    {r.relationshipType}
                    {r.sourceCharacter.status === "ARCHIVED" ||
                    r.targetCharacter.status === "ARCHIVED"
                      ? " · includes archived"
                      : ""}
                  </span>
                </li>
              ))}
              {story.relationships.length === 0 && <li>None yet.</li>}
            </ul>
          </GlassCard>

          <GlassCard className="p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Writing rules
            </p>
            <ul className="space-y-2 text-sm text-ink-dim">
              {activeRules.slice(0, 6).map((r) => (
                <li key={r.id} className="flex gap-2">
                  <span className="font-mono text-[10px] text-violet-soft">
                    P{r.priority}
                  </span>
                  <span>{r.rule}</span>
                </li>
              ))}
              {activeRules.length === 0 && <li>No active rules.</li>}
            </ul>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-rose" />
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                Story summary
              </p>
            </div>
            <p className="text-sm text-ink-dim">
              {story.currentSummary ||
                "No summary yet. Summaries will update when episodes are saved in Phase C."}
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-dim">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
