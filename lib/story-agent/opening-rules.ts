/** Deterministic rules for turning setup material into a live opening scene. */

const CONTEXT_ONLY = /\b(teaser|synopsis|backstory|character introduction|world building|prologue)\b/i;
const EXPLICITLY_ONLY = /\b(only|just)\s+(a\s+)?(teaser|synopsis|backstory|prologue)\b|\b(teaser|synopsis|backstory|prologue)\s+only\b/i;

export function shouldAutoStartFromSetup(message: string): boolean {
  return CONTEXT_ONLY.test(message) && !EXPLICITLY_ONLY.test(message);
}

export function validateLiveOpening(content: string): string[] {
  const text = content.trim();
  const issues: string[] = [];
  if (!/\bepisode\s*1\b/i.test(text)) issues.push("missing_episode_one");
  if (!/\bscene\s*1\b/i.test(text)) issues.push("missing_scene_one");
  if (!/\b(location|setting|interior|exterior|present day|morning|evening|night|day)\b/i.test(text)) issues.push("missing_active_location");
  if (!/[“"][^”"]{2,}[?”!"][^\n]*|\b(said|asked|replied|whispered|shouted)\b/i.test(text)) issues.push("missing_dialogue");
  if (!/\b(turned|walked|stepped|looked|reached|opened|closed|moved|entered|left|grabbed|held)\b/i.test(text)) issues.push("missing_character_action");
  if (!/\b(next|then|before|but|however|suddenly|when|as .*? turned)\b/i.test(text)) issues.push("missing_scene_transition");
  return issues;
}
