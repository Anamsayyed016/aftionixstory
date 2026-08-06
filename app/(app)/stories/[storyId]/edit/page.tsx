import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getOwnedStoryDetail } from "@/lib/data/stories";
import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * Edit story — wizard UI removed pending rebuild.
 */
export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const user = await requireUser();
  const { storyId } = await params;
  const story = await getOwnedStoryDetail(user.id, storyId);
  if (!story) notFound();

  return (
    <StoryStudioRebuildPlaceholder surface={`Edit · ${story.title}`} />
  );
}
