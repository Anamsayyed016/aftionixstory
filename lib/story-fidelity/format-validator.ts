/**
 * Format fidelity heuristics (Phase G.5).
 */

import type { StoryGenerationContract } from "@/lib/story-fidelity/schemas";
import type { validationViolationSchema } from "@/lib/story-fidelity/schemas";
import type { z } from "zod";

type Violation = z.infer<typeof validationViolationSchema>;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateFormatFidelity(
  text: string,
  contract: StoryGenerationContract
): { score: number; violations: Violation[]; metrics: Record<string, number> } {
  const violations: Violation[] = [];
  const metrics: Record<string, number> = {};
  let score = 1;

  const fmt = contract.requiredFormat;
  const lines = text.split(/\r?\n/);

  if (fmt.sceneDivision) {
    const sceneMarks = (
      text.match(
        /(?:^|\n)\s*(?:scene\s*\d+|SCENE\s*\d+|##\s*scene|\[\s*scene)/gi
      ) || []
    ).length;
    metrics.sceneMarks = sceneMarks;
    if (sceneMarks < 2) {
      violations.push({
        code: "FORMAT_SCENE_DIVISION",
        category: "format",
        message: "Expected labeled scene divisions",
        repairable: true,
      });
      score -= 0.25;
    }
  }

  if (fmt.characterNameCase === "upper") {
    let upperHits = 0;
    let lowerHits = 0;
    for (const c of contract.requiredCharacters) {
      const upper = c.name.toUpperCase();
      const upperRe = new RegExp(`\\b${escapeRe(upper)}\\b`);
      const mixedRe = new RegExp(`\\b${escapeRe(c.name)}\\b`, "i");
      if (upperRe.test(text)) upperHits += 1;
      else if (mixedRe.test(text)) lowerHits += 1;
    }
    metrics.upperNameHits = upperHits;
    metrics.lowerNameHits = lowerHits;
    if (contract.requiredCharacters.length > 0 && upperHits === 0) {
      violations.push({
        code: "FORMAT_NAME_CASE",
        category: "format",
        message: "Character names are not uppercase as required",
        repairable: true,
      });
      score -= 0.25;
    }
  }

  if (fmt.emotionBracketFormat) {
    const bracketEmotions = (
      text.match(
        /[A-Z][A-Z'_-]*\s*[\[(][^\]\n]{2,40}[\])]/g
      ) || []
    ).length;
    metrics.emotionBrackets = bracketEmotions;
    if (bracketEmotions < 2) {
      violations.push({
        code: "FORMAT_EMOTION_BRACKETS",
        category: "format",
        message: "Expected emotions in brackets after character names",
        repairable: true,
      });
      score -= 0.2;
    }
  }

  if (fmt.dialoguePlacement === "next_line") {
    // Pattern: NAME [emotion] then newline then dialogue
    const nextLineHits = (
      text.match(
        /[A-Z][A-Z'_-]{1,30}\s*(?:\[[^\]]+\]|\([^)]+\))?\s*\n\s*["“']/g
      ) || []
    ).length;
    metrics.dialogueNextLine = nextLineHits;
    // Also accept NAME\n dialogue without quotes for Hinglish
    const plainNext = (
      text.match(/[A-Z][A-Z'_-]{1,30}\s*(?:\[[^\]]+\])?\s*\n\s+\S+/g) || []
    ).length;
    metrics.dialogueNextLinePlain = plainNext;
    if (nextLineHits + plainNext < 2) {
      violations.push({
        code: "FORMAT_DIALOGUE_NEXT_LINE",
        category: "format",
        message: "Expected dialogue on the line after the character name",
        repairable: true,
      });
      score -= 0.2;
    }
  }

  if (fmt.episodeHeading) {
    const heading = /(?:^|\n)\s*(?:episode|EPISODE)\s*\d*/i.test(text);
    metrics.episodeHeading = heading ? 1 : 0;
    if (!heading && contract.operation.includes("episode")) {
      violations.push({
        code: "FORMAT_EPISODE_HEADING",
        category: "format",
        message: "Expected an episode heading",
        repairable: true,
      });
      score -= 0.1;
    }
  }

  void lines;
  return { score: Math.max(0, score), violations, metrics };
}
