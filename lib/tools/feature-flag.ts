/**
 * Feature flag for Story Tool Framework (Phase G).
 */

export function isStoryToolFrameworkEnabled(): boolean {
  const raw = (process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED || "false")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
