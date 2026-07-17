import { StoryWizard } from "@/components/app/story-wizard";

export default function NewStoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
          Create
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          New story
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-dim">
          Define the world, cast, and rules. Episode generation is not connected
          yet — this saves your foundation for Phase C.
        </p>
      </div>
      <StoryWizard mode="create" />
    </div>
  );
}
