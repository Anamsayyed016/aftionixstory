/**
 * Allocate next episode number as max(episodeNumber)+1.
 * Caller should retry on unique conflict (P2002).
 */
export async function allocateNextEpisodeNumber(
  tx: {
    episode: {
      aggregate: (args: {
        where: { storyId: string };
        _max: { episodeNumber: true };
      }) => Promise<{ _max: { episodeNumber: number | null } }>;
    };
  },
  storyId: string
) {
  const agg = await tx.episode.aggregate({
    where: { storyId },
    _max: { episodeNumber: true },
  });
  return (agg._max.episodeNumber ?? 0) + 1;
}
