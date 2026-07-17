import { Library } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";

export default function StoriesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
          Library
        </p>
        <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          My Stories
        </h2>
        <p className="mt-2 text-sm text-ink-dim">
          Story list, search, and filters will appear here in Phase B. Nothing
          is stored yet beyond your account.
        </p>
      </div>

      <EmptyState
        icon={Library}
        title="Stories arrive in Phase B"
        description="Create Story, ownership-scoped listing, and the story workspace are intentionally not built in Phase A. This page confirms your protected route and app shell work."
      />
    </div>
  );
}
