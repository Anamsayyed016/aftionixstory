export type ChatMode = "create" | "continue";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status?: "sending" | "sent" | "error";
}

export interface ChatSuggestion {
  id: string;
  label: string;
  prompt: string;
}

export type NewStoryEntryMode = "wizard" | "chat";

export type WorkspaceAssistantPanel = "composer" | "chat";
