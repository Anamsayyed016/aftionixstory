/**
 * Prompt registry catalog (Phase E).
 */

import type { PromptId } from "@/lib/prompt-registry/ids";
import { PROMPT_IDS } from "@/lib/prompt-registry/ids";
import { conversationPrompts } from "@/lib/prompt-registry/prompts/conversation";
import { creativePrompts } from "@/lib/prompt-registry/prompts/creative";
import { knowledgePrompts } from "@/lib/prompt-registry/prompts/knowledge";
import {
  memoryPrompts,
  preferencePrompts,
} from "@/lib/prompt-registry/prompts/memory";
import { revisionPrompts } from "@/lib/prompt-registry/prompts/revision";
import {
  characterPrompts,
  internalPrompts,
  relationshipPrompts,
  storyPrompts,
} from "@/lib/prompt-registry/prompts/story-internal";
import type { PromptDefinition } from "@/lib/prompt-registry/types";

const ALL_DEFINITIONS: PromptDefinition[] = [
  ...conversationPrompts,
  ...storyPrompts,
  ...characterPrompts,
  ...relationshipPrompts,
  ...creativePrompts,
  ...revisionPrompts,
  ...knowledgePrompts,
  ...memoryPrompts,
  ...preferencePrompts,
  ...internalPrompts,
];

const BY_ID = new Map<PromptId, PromptDefinition>();
for (const def of ALL_DEFINITIONS) {
  BY_ID.set(def.id, def);
}

export function listPromptDefinitions(): PromptDefinition[] {
  return [...ALL_DEFINITIONS];
}

export function getPromptDefinition(
  promptId: PromptId | string
): PromptDefinition | null {
  return BY_ID.get(promptId as PromptId) ?? null;
}

export function getEnabledPromptDefinitions(): PromptDefinition[] {
  return ALL_DEFINITIONS.filter((d) => d.enabled);
}

/** IDs declared in catalog vs canonical list (for validation). */
export function registeredPromptIds(): PromptId[] {
  return ALL_DEFINITIONS.map((d) => d.id);
}

export function expectedPromptIds(): readonly PromptId[] {
  return PROMPT_IDS;
}
