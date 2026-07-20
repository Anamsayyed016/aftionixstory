import type { LucideIcon } from "lucide-react";
import {
  BookHeart,
  Brain,
  Ghost,
  Heart,
  HeartHandshake,
  Landmark,
  Languages,
  Laugh,
  MessagesSquare,
  PenLine,
  RefreshCw,
  Search,
  Sparkles,
  Sunrise,
  Users,
  WandSparkles,
} from "lucide-react";

import { CHAT_MAX_CHARS } from "@/lib/chat/constants";

export type CreateCategory =
  | "All"
  | "Romance"
  | "Drama"
  | "Thriller"
  | "Horror"
  | "Fantasy"
  | "Mystery"
  | "Comedy"
  | "Family"
  | "Historical"
  | "Spiritual"
  | "Coming-of-Age"
  | "Hinglish"
  | "Episode Writing";

export type StarterAccent = "primary" | "rose" | "blue";

export interface StoryStarter {
  id: string;
  title: string;
  description: string;
  category: CreateCategory;
  prompt: string;
  icon: LucideIcon;
  accent: StarterAccent;
}

export interface CreateModeShortcut {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Prefill composer and open Story Assistant */
  prompt?: string;
  /** Navigate to an existing app route instead */
  href?: string;
}

export const CREATE_CATEGORIES: CreateCategory[] = [
  "All",
  "Romance",
  "Drama",
  "Thriller",
  "Horror",
  "Fantasy",
  "Mystery",
  "Comedy",
  "Family",
  "Historical",
  "Spiritual",
  "Coming-of-Age",
  "Hinglish",
  "Episode Writing",
];

export const CREATE_PROMPT_MAX_CHARS = Math.min(CHAT_MAX_CHARS, 2000);

export const STORY_STARTERS: StoryStarter[] = [
  {
    id: "rough-idea",
    title: "Start from a rough idea",
    description: "Turn a half-formed thought into a clear story concept.",
    category: "All",
    prompt: "Help me turn this rough idea into a complete story concept: ",
    icon: Sparkles,
    accent: "primary",
  },
  {
    id: "continue-story",
    title: "Continue my story",
    description: "Pick up from your latest episode with continuity in mind.",
    category: "Episode Writing",
    prompt: "Help me continue my existing story from the latest episode.",
    icon: RefreshCw,
    accent: "blue",
  },
  {
    id: "slow-burn",
    title: "Slow-burn romance",
    description: "Emotional tension, patience, and character-first attraction.",
    category: "Romance",
    prompt:
      "Help me create a slow-burn romance with emotional tension and strong character development.",
    icon: Heart,
    accent: "rose",
  },
  {
    id: "forbidden-romance",
    title: "Forbidden romance",
    description: "Leads who want each other despite a meaningful obstacle.",
    category: "Romance",
    prompt:
      "Help me create a forbidden romance where the leads face a meaningful emotional or social obstacle.",
    icon: HeartHandshake,
    accent: "rose",
  },
  {
    id: "family-drama",
    title: "Family drama",
    description: "Secrets, loyalty, conflict, and the long road back to trust.",
    category: "Family",
    prompt:
      "Help me create a family drama involving secrets, relationships, conflict, and emotional reconciliation.",
    icon: Users,
    accent: "primary",
  },
  {
    id: "psych-thriller",
    title: "Psychological thriller",
    description: "Unreliable feelings, rising dread, and layered twists.",
    category: "Thriller",
    prompt:
      "Help me create a psychological thriller with unreliable emotions, tension, and layered twists.",
    icon: Brain,
    accent: "blue",
  },
  {
    id: "horror",
    title: "Horror story",
    description: "Atmosphere first — mystery that deepens into fear.",
    category: "Horror",
    prompt:
      "Help me create a horror story with a strong atmosphere, mystery, and escalating fear.",
    icon: Ghost,
    accent: "rose",
  },
  {
    id: "fantasy",
    title: "Fantasy world",
    description: "Original setting, stakes, cast, and a thread of mythology.",
    category: "Fantasy",
    prompt:
      "Help me build a fantasy story with an original world, conflict, characters, and mythology.",
    icon: WandSparkles,
    accent: "primary",
  },
  {
    id: "mystery",
    title: "Mystery plot",
    description: "Clues, suspects, buried secrets, and a clean reveal.",
    category: "Mystery",
    prompt:
      "Help me create a mystery story with clues, suspects, secrets, and a satisfying reveal.",
    icon: Search,
    accent: "blue",
  },
  {
    id: "comedy",
    title: "Comedy situation",
    description: "Light setups, sharp character dynamics, and fun timing.",
    category: "Comedy",
    prompt:
      "Suggest funny situations and character dynamics for a light, entertaining story.",
    icon: Laugh,
    accent: "rose",
  },
  {
    id: "historical",
    title: "Historical fiction",
    description: "Period texture with emotional characters and real conflict.",
    category: "Historical",
    prompt:
      "Help me create a historical-fiction story with emotional characters and period-appropriate conflict.",
    icon: Landmark,
    accent: "primary",
  },
  {
    id: "coming-of-age",
    title: "Coming-of-age",
    description: "Growth, identity, friendship, and hard choices.",
    category: "Coming-of-Age",
    prompt:
      "Help me create a coming-of-age story about growth, identity, friendship, and difficult choices.",
    icon: Sunrise,
    accent: "blue",
  },
  {
    id: "spiritual",
    title: "Spiritual journey",
    description: "Faith, struggle, hope, and quiet personal transformation.",
    category: "Spiritual",
    prompt:
      "Help me create a respectful spiritual story about faith, struggle, hope, and personal transformation.",
    icon: BookHeart,
    accent: "primary",
  },
  {
    id: "hinglish",
    title: "Natural Hinglish story",
    description: "Modern narration with realistic Indian dialogue rhythms.",
    category: "Hinglish",
    prompt:
      "Help me create a story in natural modern Hinglish with simple narration and realistic Indian dialogues.",
    icon: Languages,
    accent: "rose",
  },
  {
    id: "dialogue-scene",
    title: "Dialogue-driven scene",
    description: "Pauses, subtext, and tension carried by what people say.",
    category: "Drama",
    prompt:
      "Help me write a dialogue-driven scene with realistic emotions, pauses, and character tension.",
    icon: MessagesSquare,
    accent: "blue",
  },
  {
    id: "rewrite-scene",
    title: "Rewrite my scene",
    description: "Tighten pacing, dialogue, emotion, and clarity.",
    category: "All",
    prompt:
      "Help me rewrite a scene to improve pacing, dialogue, emotion, and clarity.",
    icon: PenLine,
    accent: "primary",
  },
];

export const CREATE_MODE_SHORTCUTS: CreateModeShortcut[] = [
  {
    id: "start-new",
    title: "Start a new story",
    description: "Open Story Assistant with a blank slate.",
    icon: Sparkles,
    prompt: "I want to start a new story. Help me shape the concept.",
  },
  {
    id: "continue-episode",
    title: "Continue an episode",
    description: "Choose a story from your library.",
    icon: RefreshCw,
    href: "/stories",
  },
  {
    id: "build-characters",
    title: "Build characters",
    description: "Define leads, roles, and relationships.",
    icon: BookHeart,
    prompt: "Help me build the main characters for a new story.",
  },
  {
    id: "brainstorm-plot",
    title: "Brainstorm a plot",
    description: "Explore hooks, twists, and episodic arcs.",
    icon: Brain,
    prompt: "Suggest something unique for a serialized story",
  },
  {
    id: "rewrite-scene-mode",
    title: "Rewrite a scene",
    description: "Improve an existing draft with clearer direction.",
    icon: PenLine,
    prompt:
      "Help me rewrite a scene to improve pacing, dialogue, emotion, and clarity.",
  },
];

export function filterStoryStarters(
  starters: StoryStarter[],
  category: CreateCategory
): StoryStarter[] {
  if (category === "All") return starters;
  return starters.filter(
    (starter) => starter.category === category || starter.category === "All"
  );
}

export function sanitizeStarterPrompt(
  raw: string | null | undefined
): string {
  if (raw == null) return "";
  let decoded = raw;
  try {
    // Only decode when the value still looks percent-encoded.
    decoded = /%[0-9A-Fa-f]{2}/.test(raw)
      ? decodeURIComponent(raw)
      : raw;
  } catch {
    decoded = raw;
  }
  return decoded.replace(/\u0000/g, "").trim().slice(0, CREATE_PROMPT_MAX_CHARS);
}

export function buildStoryAssistantHref(prompt: string): string {
  const cleaned = sanitizeStarterPrompt(prompt);
  const params = new URLSearchParams({ mode: "chat" });
  if (cleaned) {
    params.set("prompt", cleaned);
  }
  return `/stories/new?${params.toString()}`;
}

export function canSubmitCreatePrompt(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= CREATE_PROMPT_MAX_CHARS;
}
