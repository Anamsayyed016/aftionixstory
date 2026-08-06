import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnedEpisode } from "@/lib/data/episodes";
import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * Episode editor — UI removed pending rebuild.
 */
export default async function EpisodePage({
  params,
}: {
  params: Promise<{ storyId: string; episodeId: string }>;
}) {
  const user = await requireUser();
  const { storyId, episodeId } = await params;
  const episode = await getOwnedEpisode(user.id, storyId, episodeId);
  if (!episode) notFound();

  return (
    <StoryStudioRebuildPlaceholder
      surface={`Episode ${episode.episodeNumber} · ${episode.title}`}
    />
  );
}
