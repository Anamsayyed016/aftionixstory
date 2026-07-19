"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { ChatModeToggle } from "@/components/app/chat/chat-mode-toggle";
import { CreateStoryChat } from "@/components/app/chat/create-story-chat";
import { StoryWizard } from "@/components/app/story-wizard";
import type { NewStoryEntryMode } from "@/lib/chat/types";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";

const ENTRY_OPTIONS = [
  { id: "wizard" as const, label: "Guided Wizard" },
  { id: "chat" as const, label: "Chat Assistant" },
] as const;

export function NewStoryEntry() {
  const searchParams = useSearchParams();
  const initialMode = parseNewStoryEntryMode(searchParams.get("mode"));
  const [entryMode, setEntryMode] = useState<NewStoryEntryMode>(initialMode);

  return (
    <div className="space-y-5">
      <ChatModeToggle
        label="Story creation method"
        value={entryMode}
        options={ENTRY_OPTIONS}
        onChange={setEntryMode}
      />

      {entryMode === "wizard" ? (
        <StoryWizard mode="create" />
      ) : (
        <CreateStoryChat />
      )}
    </div>
  );
}
