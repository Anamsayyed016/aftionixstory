import { requireUser } from "@/lib/auth/session";
import { sanitizeStarterPrompt } from "@/lib/create/story-starters";
import { CreateStoryChat } from "@/components/app/chat/create-story-chat";

/**
 * App home: the universal assistant, front and center. Story requests,
 * general questions, coding help, and current-info lookups are all handled
 * through the one input — server-side routing (classifyUniversalIntent)
 * decides where each turn goes. See CreateStoryChat's own doc comment.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  await requireUser();
  const params = await searchParams;
  const rawPrompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
  const prompt = sanitizeStarterPrompt(rawPrompt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CreateStoryChat
        className="min-h-0 flex-1"
        initialComposerValue={prompt || undefined}
      />
    </div>
  );
}
