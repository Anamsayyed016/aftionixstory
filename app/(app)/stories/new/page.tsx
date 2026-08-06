import { requireUser } from "@/lib/auth/session";
import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * New story — wizard/chat UI removed pending rebuild.
 */
export default async function NewStoryPage() {
  await requireUser();

  return <StoryStudioRebuildPlaceholder surface="New story" />;
}
