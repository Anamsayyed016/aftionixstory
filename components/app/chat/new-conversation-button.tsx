"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type NewConversationButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function NewConversationButton({
  onClick,
  disabled = false,
}: NewConversationButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-8 rounded-lg px-2.5 text-xs"
      disabled={disabled}
      onClick={onClick}
      aria-label="Start new conversation"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      New
    </Button>
  );
}
