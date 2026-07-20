/**
 * Prompt registry validation (Phase E).
 */

import { STORY_INTENTS } from "@/lib/conversation-brain/intents";
import {
  getPromptDefinition,
  listPromptDefinitions,
  registeredPromptIds,
} from "@/lib/prompt-registry/registry";
import { INTENT_TO_PROMPT } from "@/lib/prompt-registry/resolve";
import { isPromptId, type PromptId } from "@/lib/prompt-registry/ids";

export type PromptRegistryValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const DETERMINISTIC_ONLY = new Set<string>([
  // Handled without AI in many paths; still mapped for safety.
]);

/**
 * Validate registry integrity. Used in tests and optional dev startup.
 */
export function validatePromptRegistry(): PromptRegistryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const defs = listPromptDefinitions();
  const seen = new Set<string>();

  for (const def of defs) {
    if (seen.has(def.id)) {
      errors.push(`duplicate prompt id: ${def.id}`);
    }
    seen.add(def.id);

    if (!isPromptId(def.id)) {
      errors.push(`unknown prompt id not in PROMPT_IDS: ${def.id}`);
    }
    if (!def.version || !/^\d+\.\d+\.\d+$/.test(def.version)) {
      // stubs may be 0.0.0
      if (def.enabled) {
        errors.push(`invalid version for ${def.id}: ${def.version}`);
      }
    }
    if (def.enabled && typeof def.builder !== "function") {
      errors.push(`missing builder for ${def.id}`);
    }
    if (def.outputMode !== "text" && def.outputMode !== "json") {
      errors.push(`invalid outputMode for ${def.id}`);
    }
    if (def.enabled && def.jsonMode === "required" && def.outputMode !== "json") {
      errors.push(`jsonMode required but outputMode not json: ${def.id}`);
    }
  }

  // Every canonical ID should have a definition (enabled or stub)
  for (const id of registeredPromptIds()) {
    if (!getPromptDefinition(id)) {
      errors.push(`registered id missing definition object: ${id}`);
    }
  }

  // Active intents must have a mapping
  for (const intent of STORY_INTENTS) {
    if (DETERMINISTIC_ONLY.has(intent)) continue;
    const promptId = INTENT_TO_PROMPT[intent];
    if (!promptId) {
      errors.push(`active intent without prompt mapping: ${intent}`);
      continue;
    }
    const def = getPromptDefinition(promptId);
    if (!def) {
      errors.push(`mapped prompt missing for intent ${intent} → ${promptId}`);
    } else if (!def.enabled && intent !== "unknown") {
      warnings.push(`intent ${intent} maps to disabled prompt ${promptId}`);
    }
  }

  // Mapping targets must be valid PromptIds
  for (const [intent, promptId] of Object.entries(INTENT_TO_PROMPT)) {
    if (!isPromptId(promptId)) {
      errors.push(`intent ${intent} maps to invalid promptId ${promptId}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertPromptRegistryValid(): void {
  const result = validatePromptRegistry();
  if (!result.ok) {
    throw new Error(
      `Prompt registry invalid:\n${result.errors.map((e) => `- ${e}`).join("\n")}`
    );
  }
}

export type { PromptId };
