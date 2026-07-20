"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ChatModeToggle } from "@/components/app/chat/chat-mode-toggle";
import { CreateStoryChat } from "@/components/app/chat/create-story-chat";
import { StoryWizard } from "@/components/app/story-wizard";
import type { NewStoryEntryMode } from "@/lib/chat/types";

const ENTRY_OPTIONS = [
  { id: "wizard" as const, label: "Guided Wizard" },
  { id: "chat" as const, label: "Chat Assistant" },
] as const;

type NewStoryEntryProps = {
  /** Sanitized on the server from searchParams — source of truth for first paint. */
  initialMode: NewStoryEntryMode;
  /** Sanitized starter prompt from the server (may be empty). */
  initialPrompt?: string;
};

/**
 * Chat shell height accounts for:
 * app header + page title + mode toggle + main padding + mobile nav (pb-24).
 * Inner CreateStoryChat uses flex + min-h-0 so the composer stays visible.
 */
export function NewStoryEntry({
  initialMode,
  initialPrompt = "",
}: NewStoryEntryProps) {
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<NewStoryEntryMode>(initialMode);
  const [starterPrompt] = useState(() => initialPrompt.trim());

  // Strip prompt from the URL after mount so refresh does not re-prefill.
  // Does not change first-paint markup (server already rendered with props).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("prompt")) return;
    url.searchParams.delete("prompt");
    if (!url.searchParams.get("mode") && initialMode === "chat") {
      url.searchParams.set("mode", "chat");
    }
    const query = url.searchParams.toString();
    router.replace(query ? `${url.pathname}?${query}` : url.pathname, {
      scroll: false,
    });
  }, [initialMode, router]);

  if (entryMode === "wizard") {
    return (
      <div className="space-y-4">
        <ChatModeToggle
          label="Story creation method"
          value={entryMode}
          options={ENTRY_OPTIONS}
          onChange={setEntryMode}
        />
        <StoryWizard mode="create" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="shrink-0">
        <ChatModeToggle
          label="Story creation method"
          value={entryMode}
          options={ENTRY_OPTIONS}
          onChange={setEntryMode}
        />
      </div>
      <div className="h-[calc(100dvh-16.5rem)] min-h-[420px] md:h-[calc(100dvh-13.5rem)]">
        <CreateStoryChat
          className="h-full min-h-0"
          initialComposerValue={starterPrompt || undefined}
        />
      </div>
    </div>
  );
}
