import { StoryStudioRebuildPlaceholder } from "@/components/app/story-studio-rebuild-placeholder";

/**
 * Dev-only preview of the Story Studio rebuild placeholder (no auth).
 * Used for desktop/mobile screenshot verification during the UI removal phase.
 */
export default function StoryStudioPlaceholderPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="p-8 text-sm text-ink-dim">
        Preview disabled in production.
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-void text-ink">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <h1 className="font-display text-lg font-semibold">
          Story Studio placeholder preview
        </h1>
      </header>
      <main className="flex flex-1 flex-col px-4 py-6">
        <StoryStudioRebuildPlaceholder surface="Chat Assistant" />
      </main>
    </div>
  );
}
