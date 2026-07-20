/**
 * Deterministic story output validator (Phase G.5).
 */

import { validateFormatFidelity } from "@/lib/story-fidelity/format-validator";
import { validateLanguageFidelity } from "@/lib/story-fidelity/language-validator";
import type {
  StoryGenerationContract,
  StoryValidationResult,
} from "@/lib/story-fidelity/schemas";
import { storyValidationResultSchema } from "@/lib/story-fidelity/schemas";

const GENERIC_LEADS = [
  "maya",
  "arun",
  "alex",
  "sarah",
  "john",
  "emily",
  "liam",
  "olivia",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countName(text: string, name: string): number {
  const re = new RegExp(`\\b${escapeRe(name)}\\b`, "gi");
  return (text.match(re) || []).length;
}

export function validateStoryOutput(params: {
  title?: string;
  content: string;
  contract: StoryGenerationContract;
}): StoryValidationResult {
  const text = `${params.title || ""}\n${params.content}`.trim();
  const violations: StoryValidationResult["violations"] = [];
  const warnings: string[] = [];
  let score = 1;
  const metrics: Record<string, number> = {
    contentLength: params.content.length,
  };

  // E. Instruction: planning-only should not produce long prose — handled upstream.
  // Start-story must produce story prose
  if (
    (params.contract.storyStatus === "writing" ||
      /start/i.test(params.contract.latestInstruction)) &&
    params.content.replace(/\s+/g, " ").trim().length < 120
  ) {
    violations.push({
      code: "INSTRUCTION_TOO_SHORT",
      category: "instruction",
      message: "Start-story request produced insufficient story prose",
      repairable: true,
    });
    score -= 0.4;
  }

  if (
    /draft ready|here is your outline|let's plan|i can help you brainstorm/i.test(
      params.content
    ) &&
    params.content.length < 400
  ) {
    violations.push({
      code: "INSTRUCTION_PLANNING_LEAK",
      category: "instruction",
      message: "Output looks like planning text, not story prose",
      repairable: true,
    });
    score -= 0.35;
  }

  // A. Character fidelity
  const required = params.contract.requiredCharacters;
  let requiredHits = 0;
  for (const c of required) {
    const hits =
      countName(text, c.name) +
      (c.displayName ? countName(text, c.displayName) : 0);
    metrics[`char_${c.name}`] = hits;
    if (hits > 0) requiredHits += 1;
    else {
      violations.push({
        code: "CHARACTER_MISSING",
        category: "character",
        message: `Required character missing: ${c.name}`,
        repairable: true,
      });
      score -= 0.3;
    }
  }
  metrics.requiredCharacterHits = requiredHits;

  // Unrelated replacement leads
  let genericHits = 0;
  for (const g of GENERIC_LEADS) {
    const hits = countName(text, g);
    if (hits >= 2) {
      const isRequired = required.some(
        (c) => c.name.toLowerCase() === g || c.displayName?.toLowerCase() === g
      );
      if (!isRequired) {
        genericHits += hits;
        violations.push({
          code: "CHARACTER_SUBSTITUTION",
          category: "character",
          message: `Unrelated lead introduced: ${g}`,
          repairable: true,
        });
        score -= 0.25;
      }
    }
  }
  metrics.genericLeadHits = genericHits;

  // B. Setting
  if (params.contract.requiredSetting) {
    const setting = params.contract.requiredSetting.toLowerCase();
    const settingHit = text.toLowerCase().includes(setting);
    metrics.settingHit = settingHit ? 1 : 0;
    if (!settingHit) {
      violations.push({
        code: "SETTING_MISSING",
        category: "setting",
        message: `Required setting missing: ${params.contract.requiredSetting}`,
        repairable: true,
      });
      score -= 0.25;
    }
    if (
      setting === "college" &&
      /\b(café|cafe|coffee\s+shop|rain-soaked\s+street)\b/i.test(text) &&
      !/\bcollege\b/i.test(text)
    ) {
      violations.push({
        code: "SETTING_SUBSTITUTION",
        category: "setting",
        message: "Unrelated café/rain setting replaced college",
        repairable: true,
      });
      score -= 0.3;
    }
  }

  // C. Language
  const lang = validateLanguageFidelity(text, params.contract);
  Object.assign(metrics, lang.metrics);
  if (!lang.ok) {
    violations.push({
      code: lang.code || "LANGUAGE_MISMATCH",
      category: "language",
      message: lang.message || "Language requirement not met",
      repairable: true,
    });
    score = Math.min(score, lang.score);
  } else {
    score = score * 0.7 + lang.score * 0.3;
  }

  // D. Format
  const fmt = validateFormatFidelity(text, params.contract);
  Object.assign(metrics, fmt.metrics);
  violations.push(...fmt.violations);
  score = (score + fmt.score) / 2;

  // F. Generic fallback
  if (
    required.length > 0 &&
    requiredHits === 0 &&
    (genericHits > 0 ||
      /untitled|chapter one|once upon a time/i.test(text.slice(0, 200)))
  ) {
    violations.push({
      code: "GENERIC_FALLBACK",
      category: "generic_fallback",
      message: "Draft appears to be a generic unrelated story",
      repairable: true,
    });
    score -= 0.4;
  }

  // Prompt template leakage
  if (
    /SYSTEM:|You are StoryVerse|STORY GENERATION CONTRACT|Return JSON only/i.test(
      params.content
    )
  ) {
    violations.push({
      code: "PROMPT_LEAKAGE",
      category: "generic_fallback",
      message: "Output contains prompt/template leakage",
      repairable: true,
    });
    score -= 0.5;
  }

  score = Math.max(0, Math.min(1, score));
  const repairable = violations.every((v) => v.repairable !== false);
  const valid = violations.length === 0 && score >= 0.55;

  return storyValidationResultSchema.parse({
    valid,
    score,
    violations,
    warnings,
    repairable: repairable && !valid,
    metrics,
  });
}
