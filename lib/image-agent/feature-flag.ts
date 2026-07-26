/**
 * Feature flag for image generation (avatars/covers). Off by default so this
 * can be toggled without a redeploy of code changes.
 */
export function isImageGenerationEnabled(): boolean {
  const raw = (process.env.IMAGE_GENERATION_ENABLED || "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
