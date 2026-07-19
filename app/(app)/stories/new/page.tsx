import { Suspense } from "react";

import { NewStoryEntry } from "@/components/app/new-story-entry";

export default function NewStoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-violet-soft">Create</p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          New story
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">
          Choose the guided wizard or chat with Story Assistant.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-panel/50" />
        }
      >
        <NewStoryEntry />
      </Suspense>
    </div>
  );
}
