/**
 * Conversational + creative style preferences (application memory, not model training).
 */

export type Formality = "casual" | "neutral" | "formal";
export type DialogueStyle = "natural" | "cinematic" | "dramatic";
export type NarrationStyle = "simple" | "cinematic" | "literary";
export type EmojiStyle = "none" | "light" | "expressive";
export type EpisodeLengthPref = "short" | "medium" | "long" | "custom";

export type StyleProfile = {
  formality: Formality;
  dialogueStyle: DialogueStyle;
  narrationStyle: NarrationStyle;
  emojiStyle: EmojiStyle;
  uppercaseForLoudDialogue: boolean;
  episodeLength: EpisodeLengthPref;
  avoidFormalHindi: boolean;
  preferShortDialogues: boolean;
  pacingHint?: "slow" | "balanced" | "fast";
  avoid: string[];
};

export const DEFAULT_STYLE_PROFILE: StyleProfile = {
  formality: "casual",
  dialogueStyle: "natural",
  narrationStyle: "simple",
  emojiStyle: "light",
  uppercaseForLoudDialogue: false,
  episodeLength: "medium",
  avoidFormalHindi: true,
  preferShortDialogues: false,
  pacingHint: "balanced",
  avoid: [],
};

export function readStyleProfile(input: {
  formality?: string | null;
  dialogueStyle?: string | null;
  narrationStyle?: string | null;
  emojiStyle?: string | null;
  uppercaseForLoudDialogue?: boolean | null;
  episodeLength?: string | null;
  avoidFormalHindi?: boolean | null;
  preferShortDialogues?: boolean | null;
  pacingHint?: string | null;
  avoid?: string[] | null;
}): StyleProfile {
  const formality =
    input.formality === "casual" ||
    input.formality === "neutral" ||
    input.formality === "formal"
      ? input.formality
      : DEFAULT_STYLE_PROFILE.formality;
  const dialogueStyle =
    input.dialogueStyle === "natural" ||
    input.dialogueStyle === "cinematic" ||
    input.dialogueStyle === "dramatic"
      ? input.dialogueStyle
      : DEFAULT_STYLE_PROFILE.dialogueStyle;
  const narrationStyle =
    input.narrationStyle === "simple" ||
    input.narrationStyle === "cinematic" ||
    input.narrationStyle === "literary"
      ? input.narrationStyle
      : DEFAULT_STYLE_PROFILE.narrationStyle;
  const emojiStyle =
    input.emojiStyle === "none" ||
    input.emojiStyle === "light" ||
    input.emojiStyle === "expressive"
      ? input.emojiStyle
      : DEFAULT_STYLE_PROFILE.emojiStyle;
  const episodeLength =
    input.episodeLength === "short" ||
    input.episodeLength === "medium" ||
    input.episodeLength === "long" ||
    input.episodeLength === "custom"
      ? input.episodeLength
      : DEFAULT_STYLE_PROFILE.episodeLength;
  const pacingHint =
    input.pacingHint === "slow" ||
    input.pacingHint === "balanced" ||
    input.pacingHint === "fast"
      ? input.pacingHint
      : DEFAULT_STYLE_PROFILE.pacingHint;

  return {
    formality,
    dialogueStyle,
    narrationStyle,
    emojiStyle,
    uppercaseForLoudDialogue: Boolean(
      input.uppercaseForLoudDialogue ??
        DEFAULT_STYLE_PROFILE.uppercaseForLoudDialogue
    ),
    episodeLength,
    avoidFormalHindi:
      typeof input.avoidFormalHindi === "boolean"
        ? input.avoidFormalHindi
        : DEFAULT_STYLE_PROFILE.avoidFormalHindi,
    preferShortDialogues: Boolean(
      input.preferShortDialogues ?? DEFAULT_STYLE_PROFILE.preferShortDialogues
    ),
    pacingHint,
    avoid: Array.isArray(input.avoid)
      ? input.avoid.filter((a) => typeof a === "string" && a.trim())
      : [],
  };
}

export function mergeStyleProfile(
  current: StyleProfile,
  patch: Partial<StyleProfile>
): StyleProfile {
  return {
    formality: patch.formality ?? current.formality,
    dialogueStyle: patch.dialogueStyle ?? current.dialogueStyle,
    narrationStyle: patch.narrationStyle ?? current.narrationStyle,
    emojiStyle: patch.emojiStyle ?? current.emojiStyle,
    uppercaseForLoudDialogue:
      typeof patch.uppercaseForLoudDialogue === "boolean"
        ? patch.uppercaseForLoudDialogue
        : current.uppercaseForLoudDialogue,
    episodeLength: patch.episodeLength ?? current.episodeLength,
    avoidFormalHindi:
      typeof patch.avoidFormalHindi === "boolean"
        ? patch.avoidFormalHindi
        : current.avoidFormalHindi,
    preferShortDialogues:
      typeof patch.preferShortDialogues === "boolean"
        ? patch.preferShortDialogues
        : current.preferShortDialogues,
    pacingHint: patch.pacingHint ?? current.pacingHint,
    avoid: [
      ...new Set([
        ...current.avoid,
        ...(Array.isArray(patch.avoid) ? patch.avoid : []),
      ]),
    ],
  };
}

export type StyleFeedbackDetection = {
  matched: boolean;
  patch: Partial<StyleProfile>;
  writingRules: string[];
  confirmReply: string;
  label: string;
};

/**
 * Convert natural feedback into safe style preference patches.
 */
export function detectStyleFeedback(
  message: string,
  current: StyleProfile
): StyleFeedbackDetection {
  const text = message.trim();
  const patch: Partial<StyleProfile> = {};
  const writingRules: string[] = [];
  let matched = false;
  let label = "none";
  let confirmReply = "";

  if (
    /\b(bahut\s+)?shuddh\b/i.test(text) ||
    /\btoo\s+formal\b/i.test(text) ||
    /\bsimple\s+(words?|human|type)\b/i.test(text) ||
    /\bsimple\s+human\b/i.test(text) ||
    /\bformal\s+hindi\s+mat\b/i.test(text) ||
    /\bformal\s+hindi\s+(avoid|nahi)\b/i.test(text)
  ) {
    matched = true;
    patch.formality = "casual";
    patch.avoidFormalHindi = true;
    patch.narrationStyle = "simple";
    label = "casual_anti_formal";
    confirmReply =
      "Got it—ab language simple, modern Hinglish rahegi; overly formal Hindi avoid karungi. ✨";
  }

  if (
    /\bdialogues?\s+natural\b/i.test(text) ||
    /\bnatural\s+(dialogues?|rakho)\b/i.test(text)
  ) {
    matched = true;
    patch.dialogueStyle = "natural";
    patch.formality = patch.formality ?? "casual";
    label = "natural_dialogues";
    confirmReply =
      "Got it ✨ Dialogues natural aur human-sounding rakhungi—overly cinematic nahi.";
  }

  if (
    /\bemoji\s+mat\b/i.test(text) ||
    /\bno\s+emoji\b/i.test(text) ||
    /\bwithout\s+emoji\b/i.test(text)
  ) {
    matched = true;
    patch.emojiStyle = "none";
    label = "emoji_none";
    confirmReply = "Theek hai—ab replies me emoji nahi use karungi.";
  } else if (
    /\bemoji\s+(bhi\s+)?(use|add)\b/i.test(text) ||
    /\bthode\s+emojis?\b/i.test(text) ||
    /\bemojis?\s+add\b/i.test(text)
  ) {
    matched = true;
    patch.emojiStyle = "light";
    label = "emoji_light";
    confirmReply = "Okay—ab replies me thode soft emojis use karungi. 😊";
  } else if (
    /\bexpressive\b/i.test(text) ||
    /\bzyada\s+emoji\b/i.test(text)
  ) {
    matched = true;
    patch.emojiStyle = "expressive";
    label = "emoji_expressive";
    confirmReply = "Done—replies thodi zyada expressive rahengi. ✨😊";
  }

  if (
    /\buppercase\b.*\bdialogue/i.test(text) ||
    /\bdialogues?\s+uppercase\b/i.test(text) ||
    /\buppercase\s+missing\b/i.test(text)
  ) {
    matched = true;
    patch.uppercaseForLoudDialogue = true;
    label = "uppercase_dialogue";
    confirmReply =
      "Samajh gayi—loud dialogues ke liye UPPERCASE use karungi. ✨";
  }

  if (
    /\bstory\s+fast\b/i.test(text) ||
    /\bfast\s+(chal|hai)\b/i.test(text) ||
    /\btoo\s+fast\b/i.test(text) ||
    /\bslow\s+(karo|burn|pacing)\b/i.test(text) ||
    /\bpacing\s+slow\b/i.test(text) ||
    /\bslow\s+pacing\b/i.test(text)
  ) {
    matched = true;
    patch.pacingHint = "slow";
    writingRules.push("Avoid rushed transitions; keep emotional beats slow.");
    label = "pacing_slow";
    confirmReply = "Theek hai—pacing slow/balanced rakhungi, rush nahi karungi. 🤍";
  }

  if (
    /\bdialogues?\s+short\b/i.test(text) ||
    /\bshort\s+dialogues?\b/i.test(text)
  ) {
    matched = true;
    patch.preferShortDialogues = true;
    label = "short_dialogues";
    confirmReply = "Okay—dialogues short aur natural rakhungi.";
  }

  if (
    /\brandom\s+characters?\b/i.test(text) ||
    /\bextra\s+characters?\s+mat\b/i.test(text) ||
    /\bnaye\s+characters?\s+mat\b/i.test(text)
  ) {
    matched = true;
    writingRules.push(
      "Only use established or explicitly introduced named characters."
    );
    patch.avoid = [...(current.avoid ?? []), "random new named characters"];
    label = "no_random_characters";
    confirmReply =
      "Got it—random naye named characters nahi laungi unless aap bolo. 👀";
  }

  if (/\bmore\s+emotional\b/i.test(text) || /\bemotional\s+karo\b/i.test(text)) {
    matched = true;
    patch.dialogueStyle = "natural";
    writingRules.push("Lean into emotional subtext and pauses.");
    label = "more_emotional";
    confirmReply = "Haan—zyada emotional beats aur pauses rakhungi. 🥹";
  }

  return {
    matched,
    patch,
    writingRules,
    confirmReply:
      confirmReply ||
      (matched
        ? "Preference save kar di. Aage writing isi hisaab se rahegi. ✨"
        : ""),
    label,
  };
}

/** Light emoji decoration for conversational replies (never story prose). */
export function maybeDecorateChatReply(
  reply: string,
  emojiStyle: EmojiStyle
): string {
  if (emojiStyle === "none") return reply;
  // Already has an emoji / pictograph / dingbat
  if (
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(reply) ||
    /[✨❤️🤍😊😅😂🥹🤭👀🙈]/.test(reply)
  ) {
    return reply;
  }

  const pool =
    emojiStyle === "expressive"
      ? ["✨", "❤️", "😊", "🥹", "👀", "🤭"]
      : ["✨", "😊", "🤍"];

  // Deterministic-ish pick from reply length to avoid pure randomness in tests
  const emoji = pool[reply.length % pool.length];
  const trimmed = reply.trim();
  if (!trimmed) return reply;
  if (/[.!?]$/.test(trimmed)) {
    return `${trimmed.slice(0, -1)} ${emoji}${trimmed.slice(-1)}`;
  }
  return `${trimmed} ${emoji}`;
}

export function formatStylePromptBlock(style: StyleProfile): string {
  const lines = [
    `Formality: ${style.formality}`,
    `Dialogue style: ${style.dialogueStyle}`,
    `Narration style: ${style.narrationStyle}`,
    `Prefer short dialogues: ${style.preferShortDialogues ? "yes" : "no"}`,
    `Avoid overly formal/shuddh Hindi: ${style.avoidFormalHindi ? "yes" : "no"}`,
    `Loud dialogue UPPERCASE: ${style.uppercaseForLoudDialogue ? "yes" : "no"}`,
    `Pacing hint: ${style.pacingHint || "balanced"}`,
    `Episode length preference: ${style.episodeLength}`,
  ];
  if (style.avoid.length) {
    lines.push(`Avoid: ${style.avoid.join("; ")}`);
  }
  return lines.join("\n");
}
