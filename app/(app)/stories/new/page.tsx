import { redirect } from "next/navigation";
import Link from "next/link";

import { StoryWizard } from "@/components/app/story-wizard";
import { sanitizeStarterPrompt } from "@/lib/create/story-starters";
import { parseNewStoryPageParams } from "@/lib/chat/new-story-page-params";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; prompt?: string | string[] }>;
}) {
  const raw = await searchParams;
  const { mode, prompt } = parseNewStoryPageParams(raw);

  // Chat now lives on the home assistant — forward there with the prompt preserved.
  if (mode === "chat") {
    const cleaned = sanitizeStarterPrompt(prompt);
    redirect(cleaned ? `/dashboard?prompt=${encodeURIComponent(cleaned)}` : "/home");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-violet-soft">Create</p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            New story
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-dim">
            Step through the guided form to set up your story.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-lilac hover:underline">
          Prefer to chat with the assistant instead?
        </Link>
      </div>
      <StoryWizard mode="create" />
    </div>
  );
}
