"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ContinueDraftState = {
  title: string;
  content: string;
  wordCount: number;
  clientRequestId: string;
  action: string;
  proposedEpisodeNumber: number;
  replaceEpisodeId?: string;
  userInstruction: string;
  dirty: boolean;
};

type ContinueStoryToolbarProps = {
  busy: boolean;
  saving: boolean;
  canSave: boolean;
  archived: boolean;
  onRegenerate: () => void;
  onSave: () => void;
  onDiscard: () => void;
  className?: string;
};

export function ContinueStoryToolbar({
  busy,
  saving,
  canSave,
  archived,
  onRegenerate,
  onSave,
  onDiscard,
  className,
}: ContinueStoryToolbarProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        type="button"
        variant="secondary"
        className="rounded-xl"
        disabled={busy || saving || archived}
        onClick={onRegenerate}
      >
        Regenerate
      </Button>
      <Button
        type="button"
        className="rounded-xl"
        disabled={!canSave || busy || saving || archived}
        loading={saving}
        onClick={onSave}
      >
        Save Episode
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="rounded-xl"
        disabled={busy || saving}
        onClick={onDiscard}
      >
        Discard
      </Button>
    </div>
  );
}
