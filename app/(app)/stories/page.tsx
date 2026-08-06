import { requireUser } from "@/lib/auth/session";
import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * Story library — UI removed pending Story Studio rebuild.
 * Story data and plan limits remain in the database / billing layer.
 */
export default async function StoriesPage() {
  await requireUser();

  return <StoryStudioRebuildPlaceholder surface="My Stories" />;
}
