import type { ChatMode, ChatSuggestion } from "@/lib/chat/types";

export const CHAT_MAX_CHARS = 4000;

export const DEMO_ASSISTANT_REPLIES: Record<ChatMode, string> = {
  create:
    "Your idea has been captured. In the next phase, I’ll turn it into structured story details and let you confirm them before creating the story.",
  continue:
    "Your instruction has been captured. In the next phase, I’ll use the existing story context and Gemini episode generation pipeline.",
};

export const CREATE_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "create-ceo-romance",
    label: "A forbidden romance with a powerful CEO",
    prompt: "A forbidden romance with a powerful CEO",
  },
  {
    id: "create-dark-fantasy",
    label: "A dark fantasy about a cursed kingdom",
    prompt: "A dark fantasy about a cursed kingdom",
  },
  {
    id: "create-college-romance",
    label: "A college romance with mystery and comedy",
    prompt: "A college romance with mystery and comedy",
  },
  {
    id: "create-from-scratch",
    label: "Help me create a story from scratch",
    prompt: "Help me create a story from scratch",
  },
];

export const CONTINUE_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "continue-romance",
    label: "Continue with romance and emotional tension",
    prompt: "Continue with romance and emotional tension",
  },
  {
    id: "continue-reunion",
    label: "Add a family reunion scene",
    prompt: "Add a family reunion scene",
  },
  {
    id: "continue-misunderstanding",
    label: "Create a misunderstanding between the leads",
    prompt: "Create a misunderstanding between the leads",
  },
  {
    id: "continue-funny-emotional",
    label: "Make the next episode funny but emotional",
    prompt: "Make the next episode funny but emotional",
  },
];

export const CHAT_SHELL_COPY: Record<
  ChatMode,
  { title: string; emptyTitle: string; emptyDescription: string; placeholder: string }
> = {
  create: {
    title: "Create with Story Assistant",
    emptyTitle: "Let’s build your story together",
    emptyDescription:
      "Describe your idea naturally. The assistant will later help shape the title, genre, characters, world, tone, and plot.",
    placeholder: "Describe the story you want to create…",
  },
  continue: {
    title: "Continue with Story Assistant",
    emptyTitle: "What should happen next?",
    emptyDescription:
      "Give an instruction for the next episode. Story continuity and existing characters will be connected in a later phase.",
    placeholder: "Describe what should happen in the next episode…",
  },
};
