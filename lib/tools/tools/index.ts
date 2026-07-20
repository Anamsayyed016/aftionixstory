/**
 * Builtin Story Tools catalog (Phase G).
 */

import type { StoryToolDefinition } from "@/lib/tools/types";
import { characterTools } from "@/lib/tools/tools/character";
import { relationshipTools } from "@/lib/tools/tools/relationship";
import {
  locationTools,
  timelineTools,
} from "@/lib/tools/tools/timeline";
import {
  preferencesTools,
  storyTools,
  writingRulesTools,
} from "@/lib/tools/tools/story";
import { searchTools, validationTools } from "@/lib/tools/tools/search";

export function createBuiltinTools(): StoryToolDefinition[] {
  return [
    ...characterTools,
    ...relationshipTools,
    ...locationTools,
    ...timelineTools,
    ...storyTools,
    ...writingRulesTools,
    ...preferencesTools,
    ...searchTools,
    ...validationTools,
  ];
}

export {
  characterTools,
  relationshipTools,
  locationTools,
  timelineTools,
  storyTools,
  writingRulesTools,
  preferencesTools,
  searchTools,
  validationTools,
};
