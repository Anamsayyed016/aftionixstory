/**
 * Answered-question tracking & repeated-question prevention (Phase G.5).
 */

import {
  type AnsweredQuestion,
  type QuestionKey,
  type ResolvedStoryFacts,
} from "@/lib/story-fidelity/schemas";

export type ShouldAskResult =
  | { allowed: true }
  | {
      allowed: false;
      blocked: true;
      reason: string;
      existingAnswer: string;
    };

function answerForKey(
  facts: ResolvedStoryFacts,
  key: QuestionKey
): string | null {
  switch (key) {
    case "story_language":
      return facts.language.storyLanguage;
    case "primary_setting":
      return facts.setting.primarySetting;
    case "main_male_lead":
      return facts.characters.mainMaleLead;
    case "main_female_lead":
      return facts.characters.mainFemaleLead;
    case "leads":
      if (facts.characters.mainMaleLead && facts.characters.mainFemaleLead) {
        return `${facts.characters.mainMaleLead} / ${facts.characters.mainFemaleLead}`;
      }
      return null;
    case "genre":
      return facts.genre[0] ?? null;
    case "tone":
      return facts.tone[0] ?? null;
    case "format_uppercase":
      return facts.formatRules.uppercaseCharacterNames ? "uppercase" : null;
    case "format_emotion":
      return facts.formatRules.emotionInBrackets ? "brackets" : null;
    case "format_dialogue":
      return facts.formatRules.dialogueOnNextLine ? "next_line" : null;
    case "format_scenes":
      return facts.formatRules.sceneDivisions ? "scenes" : null;
    case "start_permission":
      return facts.conversationRules.doNotStartStoryYet
        ? "do_not_start"
        : facts.storyStatus === "writing" || facts.storyStatus === "ready"
          ? "may_start"
          : null;
    default:
      return null;
  }
}

export function shouldAskQuestion(
  questionKey: QuestionKey,
  resolvedFacts: ResolvedStoryFacts,
  answered?: AnsweredQuestion[]
): ShouldAskResult {
  if (!resolvedFacts.conversationRules.avoidRepeatedQuestions) {
    return { allowed: true };
  }

  const fromFacts = answerForKey(resolvedFacts, questionKey);
  if (fromFacts) {
    return {
      allowed: false,
      blocked: true,
      reason: "answer_already_in_resolved_facts",
      existingAnswer: fromFacts,
    };
  }

  const prior = answered?.find((a) => a.key === questionKey);
  if (prior) {
    return {
      allowed: false,
      blocked: true,
      reason: "answer_already_recorded",
      existingAnswer: prior.answer,
    };
  }

  return { allowed: true };
}

/** Map free-text clarification / offer prompts to question keys. */
export function detectQuestionKeysInText(text: string): QuestionKey[] {
  const lower = text.toLowerCase();
  const keys: QuestionKey[] = [];
  if (
    /college\s+ya|setting\s*\?|unexpected\s+place|kis\s+setting|where\s+(?:is|does)/i.test(
      lower
    )
  ) {
    keys.push("primary_setting");
  }
  if (/which\s+language|kis\s+language|hinglish\s+ya|language\s*\?/i.test(lower)) {
    keys.push("story_language");
  }
  if (
    /male\s+lead|female\s+lead|character\s+names|lead\s+names|kaun\s+(?:hai|hain)\s+lead/i.test(
      lower
    )
  ) {
    keys.push("leads", "main_male_lead", "main_female_lead");
  }
  if (/genre\s*\?|kis\s+genre/i.test(lower)) keys.push("genre");
  return keys;
}

export function recordAnsweredQuestionsFromFacts(
  existing: AnsweredQuestion[],
  facts: ResolvedStoryFacts
): AnsweredQuestion[] {
  const now = new Date().toISOString();
  const map = new Map(existing.map((a) => [a.key, a]));
  const keys: QuestionKey[] = [
    "story_language",
    "primary_setting",
    "main_male_lead",
    "main_female_lead",
    "leads",
    "format_uppercase",
    "format_emotion",
    "format_dialogue",
    "format_scenes",
    "start_permission",
  ];
  for (const key of keys) {
    const answer = answerForKey(facts, key);
    if (answer) {
      map.set(key, {
        key,
        answer,
        answeredAt: map.get(key)?.answeredAt || now,
        source: "locked_fact",
      });
    }
  }
  return [...map.values()];
}

/**
 * Returns true if the proposed clarification should be suppressed.
 */
export function shouldSuppressClarification(params: {
  question: string | null | undefined;
  facts: ResolvedStoryFacts;
  answered: AnsweredQuestion[];
}): { suppress: boolean; reason?: string; existingAnswer?: string } {
  if (!params.question) return { suppress: false };
  const keys = detectQuestionKeysInText(params.question);
  for (const key of keys) {
    const result = shouldAskQuestion(key, params.facts, params.answered);
    if (!result.allowed) {
      return {
        suppress: true,
        reason: result.reason,
        existingAnswer: result.existingAnswer,
      };
    }
  }
  return { suppress: false };
}
