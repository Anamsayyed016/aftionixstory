import { notFound } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getOwnedStoryDetail } from "@/lib/data/stories";
import { StoryWorkspaceClient } from "@/components/app/story-workspace";
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

      <StoryWorkspaceClient
        storyId={story.id}
        storyTitle={story.title}
        storyStatus={story.status}
        currentSummary={story.currentSummary}
        episodes={story.episodes.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
        }))}
        characters={activeCharacters.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
        }))}
        relationships={story.relationships.map((r) => ({
          id: r.id,
          label: `${r.sourceCharacter.name} → ${r.targetCharacter.name}`,
          type: r.relationshipType,
        }))}
        writingRules={activeRules.map((r) => ({
          id: r.id,
          rule: r.rule,
          priority: r.priority,
        }))}
        overview={{
          setting: story.setting,
          timePeriod: story.timePeriod,
          mainConflict: story.mainConflict,
          initialPlot: story.initialPlot,
          worldRules: story.worldRules,
          contentBoundaries: story.contentBoundaries,
          writingStyle: story.writingStyle,
          pointOfView: story.pointOfView,
          pacing: story.pacing,
          episodeLength: story.episodeLength,
        }}
      />
    </div>
  );
}
