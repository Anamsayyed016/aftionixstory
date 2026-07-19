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
    id: "create-new-concept",
    label: "I have a new story concept",
    prompt: "I have a new story concept",
  },
  {
    id: "create-forbidden-romance",
    label: "Help me create a forbidden romance",
    prompt: "Help me create a forbidden romance",
  },
  {
    id: "create-two-characters",
    label: "I only have two characters",
    prompt: "I only have two characters so far",
  },
  {
    id: "create-suggest-unique",
    label: "Suggest something unique",
    prompt: "Suggest something unique for a serialized story",
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
    title: "Story Assistant",
    emptyTitle: "Let’s create your story",
    emptyDescription:
      "Tell me your story idea however it comes to you — one line, a character, a scene, or even a rough feeling. I’ll help you build it.",
    placeholder: "Tell me your idea…",
  },
  continue: {
    title: "Continue with Story Assistant",
    emptyTitle: "What should happen next?",
    emptyDescription:
      "Give an instruction for the next episode. Story continuity and existing characters will be connected in a later phase.",
    placeholder: "Describe what should happen in the next episode…",
  },
};
