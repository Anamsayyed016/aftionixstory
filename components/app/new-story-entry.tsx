"use client";

import { useEffect, useState } from "react";

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
 * Strip `prompt` from the address bar without a Next.js soft navigation.
 * Using the App Router replace API re-renders the RSC page and can remount/abort
 * chat boot, leaving restoring=true and disabling Send forever.
 */
export function stripPromptQueryFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("prompt")) return;
  url.searchParams.delete("prompt");
  const query = url.searchParams.toString();
  const next = query ? `${url.pathname}?${query}` : url.pathname;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Chat shell height accounts for:
 * app header + page title + mode toggle + main padding + mobile nav (pb-24).
 * Inner CreateStoryChat uses flex + min-h-0 so the composer stays visible.
 */
export function NewStoryEntry({
  initialMode,
  initialPrompt = "",
}: NewStoryEntryProps) {
  const [entryMode, setEntryMode] = useState<NewStoryEntryMode>(initialMode);
  const [starterPrompt] = useState(() => initialPrompt.trim());

  useEffect(() => {
    stripPromptQueryFromUrl();
  }, []);

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
