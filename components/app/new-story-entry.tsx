"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChatModeToggle } from "@/components/app/chat/chat-mode-toggle";
import { CreateStoryChat } from "@/components/app/chat/create-story-chat";
import { StoryWizard } from "@/components/app/story-wizard";
import type { NewStoryEntryMode } from "@/lib/chat/types";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";
import { captureStarterPrompt } from "@/lib/create/story-starters";

const ENTRY_OPTIONS = [
  { id: "wizard" as const, label: "Guided Wizard" },
  { id: "chat" as const, label: "Chat Assistant" },
] as const;

/**
 * Chat shell height accounts for:
 * app header + page title + mode toggle + main padding + mobile nav (pb-24).
 * Inner CreateStoryChat uses flex + min-h-0 so the composer stays visible.
 */
export function NewStoryEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = parseNewStoryEntryMode(searchParams.get("mode"));
  const [entryMode, setEntryMode] = useState<NewStoryEntryMode>(initialMode);
  const [starterPrompt] = useState(() =>
    captureStarterPrompt(searchParams.get("prompt"))
  );

  useEffect(() => {
    if (!searchParams.has("prompt")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("prompt");
    if (!params.get("mode")) params.set("mode", "chat");
    const query = params.toString();
    router.replace(query ? `/stories/new?${query}` : "/stories/new", {
      scroll: false,
    });
  }, [router, searchParams]);

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
