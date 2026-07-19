"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { ChatModeToggle } from "@/components/app/chat/chat-mode-toggle";
import { CreateStoryChat } from "@/components/app/chat/create-story-chat";
import { StoryWizard } from "@/components/app/story-wizard";
import type { NewStoryEntryMode } from "@/lib/chat/types";
import { parseNewStoryEntryMode } from "@/lib/chat/utils";
import { cn } from "@/lib/utils";

const ENTRY_OPTIONS = [
  { id: "wizard" as const, label: "Guided Wizard" },
  { id: "chat" as const, label: "Chat Assistant" },
] as const;

export function NewStoryEntry() {
  const searchParams = useSearchParams();
  const initialMode = parseNewStoryEntryMode(searchParams.get("mode"));
  const [entryMode, setEntryMode] = useState<NewStoryEntryMode>(initialMode);

  return (
    <div className={cn("space-y-4", entryMode === "chat" && "space-y-3")}>
      <ChatModeToggle
        label="Story creation method"
        value={entryMode}
        options={ENTRY_OPTIONS}
        onChange={setEntryMode}
      />

      {entryMode === "wizard" ? (
        <StoryWizard mode="create" />
      ) : (
        <div className="h-[calc(100dvh-11.5rem)] min-h-[520px] md:h-[calc(100dvh-10rem)]">
          <CreateStoryChat className="h-full" />
        </div>
      )}
    </div>
  );
}
