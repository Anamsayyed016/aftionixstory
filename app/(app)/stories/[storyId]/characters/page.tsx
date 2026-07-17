import { notFound } from "next/navigation";
import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { getOwnedStoryDetail } from "@/lib/data/stories";
import { CharactersManager } from "./characters-manager";

export default async function StoryCharactersPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const user = await requireUser();
  const { storyId } = await params;
  const story = await getOwnedStoryDetail(user.id, storyId);
  if (!story) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
            Cast
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-ink">
            Characters · {story.title}
          </h2>
        </div>
        <Link href={`/stories/${story.id}`} className="text-sm text-lilac hover:underline">
          Back to workspace
        </Link>
      </div>
      <CharactersManager
        storyId={story.id}
        initialCharacters={story.characters.map((c) => ({
          id: c.id,
          name: c.name,
          age: c.age,
          gender: c.gender,
          role: c.role,
          personality: c.personality,
          appearance: c.appearance,
          background: c.background,
          speakingStyle: c.speakingStyle,
          secrets: c.secrets,
          emotionalState: c.emotionalState,
          status: c.status,
          _count: c._count,
        }))}
        initialRelationships={story.relationships}
      />
    </div>
  );
}
