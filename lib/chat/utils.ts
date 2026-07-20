import {
  CHAT_MAX_CHARS,
  DEMO_ASSISTANT_REPLIES,
} from "@/lib/chat/constants";
import type {
  ChatMessage,
  ChatMode,
  ChatRole,
  NewStoryEntryMode,
} from "@/lib/chat/types";

export function parseNewStoryEntryMode(
  mode: string | null | undefined
): NewStoryEntryMode {
  return mode === "chat" ? "chat" : "wizard";
}

export function canSendMessage(content: string, busy: boolean): boolean {
  const trimmed = content.trim();
  return (
    !busy && trimmed.length > 0 && trimmed.length <= CHAT_MAX_CHARS
  );
}

/**
 * Composer / suggestion clicks must not stay locked for the whole history restore.
 * Lock only while we still lack an active conversation during boot, or while
 * creating / archived.
 */
export function isComposerInteractionLocked(opts: {
  creating?: boolean;
  archived?: boolean;
  restoring?: boolean;
  conversationId?: string | null;
}): boolean {
  if (opts.creating) return true;
  if (opts.archived) return true;
  if (opts.restoring && !opts.conversationId) return true;
  return false;
}

export function shouldSendOnKeyDown(event: {
  key: string;
  shiftKey: boolean;
}): boolean {
  return event.key === "Enter" && !event.shiftKey;
}

export function getDemoAssistantReply(mode: ChatMode): string {
  return DEMO_ASSISTANT_REPLIES[mode];
}

export function createLocalMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildChatMessage(
  role: ChatRole,
  content: string,
  status: ChatMessage["status"] = "sent"
): ChatMessage {
  return {
    id: createLocalMessageId(),
    role,
    content,
    createdAt: new Date().toISOString(),
    status,
  };
}
