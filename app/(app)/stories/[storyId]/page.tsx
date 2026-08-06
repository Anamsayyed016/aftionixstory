import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnedStoryDetail } from "@/lib/data/stories";
import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * Story workspace — UI removed pending rebuild.
 * Ownership check kept so unknown IDs still 404.
 */
export default async function StoryWorkspacePage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const user = await requireUser();
  const { storyId } = await params;
  const story = await getOwnedStoryDetail(user.id, storyId);
  if (!story) notFound();

  return (
    <StoryStudioRebuildPlaceholder surface={`Story · ${story.title}`} />
  );
}
