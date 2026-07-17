import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import {
  getAdjacentEpisodes,
  getOwnedEpisode,
} from "@/lib/data/episodes";
import { EpisodeEditor } from "@/components/app/episode-editor";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ storyId: string; episodeId: string }>;
}) {
  const user = await requireUser();
  const { storyId, episodeId } = await params;
  const episode = await getOwnedEpisode(user.id, storyId, episodeId);
  if (!episode) notFound();

  const { previous, next } = await getAdjacentEpisodes(
    storyId,
    episode.episodeNumber
  );

  return (
    <EpisodeEditor
      storyId={storyId}
      episodeId={episode.id}
      episodeNumber={episode.episodeNumber}
      initialTitle={episode.title}
      initialContent={episode.content}
      summary={episode.summary}
      wordCount={episode.wordCount}
      version={episode.version}
      previous={previous}
      next={next}
      versions={episode.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        title: v.title,
        changeReason: v.changeReason,
        createdAt: v.createdAt.toISOString(),
        preview: v.content.slice(0, 280),
      }))}
    />
  );
}
