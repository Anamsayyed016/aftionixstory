import { NewStoryEntry } from "@/components/app/new-story-entry";
import {
  parseNewStoryPageParams,
  type NewStoryPageSearchParams,
} from "@/lib/chat/new-story-page-params";

export default async function NewStoryPage({
  searchParams,
}: {
  searchParams: Promise<NewStoryPageSearchParams>;
}) {
  const raw = await searchParams;
  const { mode, prompt } = parseNewStoryPageParams(raw);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-violet-soft">Create</p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          New story
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">
          Choose the guided wizard or chat with Story Assistant.
        </p>
      </div>
      <NewStoryEntry initialMode={mode} initialPrompt={prompt} />
    </div>
  );
}
