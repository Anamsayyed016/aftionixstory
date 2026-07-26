const FIELD_MAX = 500;

function truncate(value: string, max = FIELD_MAX): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export type CharacterPromptInput = {
  name: string;
  age?: number | null;
  gender?: string | null;
  role: string;
  personality: string;
  appearance?: string | null;
  background?: string | null;
  speakingStyle?: string | null;
};

export function buildCharacterAvatarPrompt(character: CharacterPromptInput): string {
  const parts: string[] = [
    `Portrait avatar of a fictional character named ${character.name}, a ${character.role}.`,
  ];
  if (character.age != null) parts.push(`Age: ${character.age}.`);
  if (character.gender) parts.push(`Gender: ${truncate(character.gender, 60)}.`);
  if (character.appearance) parts.push(`Appearance: ${truncate(character.appearance)}.`);
  parts.push(`Personality: ${truncate(character.personality)}.`);
  if (character.speakingStyle) {
    parts.push(`Speaking style: ${truncate(character.speakingStyle)}.`);
  }
  if (character.background) parts.push(`Background: ${truncate(character.background)}.`);
  parts.push(
    "Digital illustration, character portrait, head and shoulders, detailed and expressive face, high quality."
  );
  return parts.join(" ");
}

export type StoryPromptInput = {
  title: string;
  genre: string;
  tone?: string | null;
  setting?: string | null;
  currentSummary?: string | null;
  description?: string | null;
};

export function buildStoryCoverPrompt(story: StoryPromptInput): string {
  const parts: string[] = [
    `Book cover illustration for a ${story.genre} story titled "${story.title}".`,
  ];
  if (story.tone) parts.push(`Tone: ${truncate(story.tone, 120)}.`);
  if (story.setting) parts.push(`Setting: ${truncate(story.setting)}.`);
  const summary = story.currentSummary || story.description;
  if (summary) parts.push(`Story summary: ${truncate(summary)}.`);
  parts.push(
    "Digital painting, cinematic composition, atmospheric lighting, high quality, no text or typography."
  );
  return parts.join(" ");
}
