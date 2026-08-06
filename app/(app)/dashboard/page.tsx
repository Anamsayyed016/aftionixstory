import { requireUser } from "@/lib/auth/session";
import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * Chat Assistant surface — UI removed pending Story Studio rebuild.
 * Backend (/api/chat/stream, storyAgentTurnAction) remains intact.
 */
export default async function DashboardPage() {
  await requireUser();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StoryStudioRebuildPlaceholder surface="Chat Assistant" />
    </div>
  );
}
