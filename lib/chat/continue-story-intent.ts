import type { GenerationAction } from "@prisma/client";

export type ContinueIntentStatus = "actionable" | "needs_more_info";

export type ContinueIntentResult = {
  status: ContinueIntentStatus;
  action: GenerationAction;
  assistantReply?: string;
  followUpQuestion?: string;
  normalizedInstruction: string;
};

const VAGUE_EXACT = [
  /^continue\.?$/i,
  /^next\.?$/i,
  /^go on\.?$/i,
  /^more\.?$/i,
  /^yes\.?$/i,
  /^ok\.?$/i,
  /^okay\.?$/i,
  /^please\.?$/i,
  /^write\.?$/i,
  /^generate\.?$/i,
  /^continue the story\.?$/i,
  /^next episode\.?$/i,
  /^write next\.?$/i,
  /^keep going\.?$/i,
  /^do it\.?$/i,
];

const ACTION_HINTS: Array<{ pattern: RegExp; action: GenerationAction }> = [
  { pattern: /\b(regenerat|rewrite from scratch|start over)\b/i, action: "REGENERATE" },
  { pattern: /\b(improv(e|ing) (the )?writ|polish|tighten prose)\b/i, action: "IMPROVE_WRITING" },
  { pattern: /\b(comed(y|ic)|funny|humou?r|lighten)\b/i, action: "ADD_COMEDY" },
  { pattern: /\b(romanc|romantic|love tension|chemistry)\b/i, action: "MORE_ROMANTIC" },
  { pattern: /\b(emotion(al)?|heartfelt|tearjerker)\b/i, action: "MORE_EMOTIONAL" },
  { pattern: /\b(continu|next episode|what happens next)\b/i, action: "CONTINUE" },
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Decide whether a continue-chat instruction is actionable.
 * Vague instructions return needs_more_info without calling generation.
 */
export function assessContinueInstruction(
  instruction: string,
  options?: { hasSavedEpisodes?: boolean; forceAction?: GenerationAction }
): ContinueIntentResult {
  const normalizedInstruction = instruction.trim().replace(/\s+/g, " ");
  const words = wordCount(normalizedInstruction);

  if (normalizedInstruction.length < 3) {
    return {
      status: "needs_more_info",
      action: options?.hasSavedEpisodes ? "CONTINUE" : "NEW_EPISODE",
      normalizedInstruction,
      assistantReply:
        "I need a clearer instruction for the next episode.",
      followUpQuestion:
        "What should happen next — who is involved, and what mood should it have?",
    };
  }

  const isVagueExact = VAGUE_EXACT.some((re) => re.test(normalizedInstruction));
  const tooThin = words < 4 && normalizedInstruction.length < 24;

  if ((isVagueExact || tooThin) && !options?.forceAction) {
    return {
      status: "needs_more_info",
      action: options?.hasSavedEpisodes ? "CONTINUE" : "NEW_EPISODE",
      normalizedInstruction,
      assistantReply:
        "I can continue the story — tell me a bit more so it stays on track.",
      followUpQuestion:
        "Which characters should lead this scene, and should the tone be romantic, funny, tense, or emotional?",
    };
  }

  let action: GenerationAction =
    options?.forceAction ??
    (options?.hasSavedEpisodes ? "CONTINUE" : "NEW_EPISODE");

  if (!options?.forceAction) {
    for (const hint of ACTION_HINTS) {
      if (hint.pattern.test(normalizedInstruction)) {
        action = hint.action;
        break;
      }
    }
  }

  if (action === "REGENERATE" && !options?.hasSavedEpisodes) {
    action = options?.hasSavedEpisodes ? "CONTINUE" : "NEW_EPISODE";
  }

  return {
    status: "actionable",
    action,
    normalizedInstruction,
  };
}

/**
 * Build a revision instruction without dumping the full unsaved draft into prompts.
 */
export function buildRevisionInstruction(params: {
  baseInstruction: string;
  revision: string;
}): string {
  const base = params.baseInstruction.trim();
  const revision = params.revision.trim();
  return [
    base ? `Original direction: ${base}` : null,
    `Revision request: ${revision}`,
    "Apply this revision while preserving story continuity, established characters, and writing rules.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isCreateEnabledForDraft(params: {
  title: string;
  content: string;
}): boolean {
  return params.title.trim().length >= 1 && params.content.trim().length >= 20;
}
