/**
 * Story generation contract builder + serialization (Phase G.5).
 */

import type {
  ResolvedStoryFacts,
  StoryGenerationContract,
} from "@/lib/story-fidelity/schemas";
import { storyGenerationContractSchema } from "@/lib/story-fidelity/schemas";

export function buildStoryGenerationContract(params: {
  facts: ResolvedStoryFacts;
  operation: string;
  latestInstruction: string;
}): StoryGenerationContract {
  const { facts } = params;
  const requiredCharacters: StoryGenerationContract["requiredCharacters"] = [];

  if (facts.characters.mainMaleLead) {
    const name = facts.characters.mainMaleLead;
    requiredCharacters.push({
      name,
      role: "male_lead",
      displayName: facts.formatRules.uppercaseCharacterNames
        ? name.toUpperCase()
        : name,
    });
  }
  if (facts.characters.mainFemaleLead) {
    const name = facts.characters.mainFemaleLead;
    requiredCharacters.push({
      name,
      role: "female_lead",
      displayName: facts.formatRules.uppercaseCharacterNames
        ? name.toUpperCase()
        : name,
    });
  }
  for (const n of facts.characters.confirmedCharacters) {
    if (
      !requiredCharacters.some(
        (c) => c.name.toLowerCase() === n.toLowerCase()
      )
    ) {
      requiredCharacters.push({
        name: n,
        role: null,
        displayName: facts.formatRules.uppercaseCharacterNames
          ? n.toUpperCase()
          : n,
      });
    }
  }

  const forbidden: string[] = [
    "Do not invent replacement lead names",
    "Do not replace confirmed setting",
    "Do not switch language away from the required story language",
    "Do not ignore format rules",
    "Do not output planning text when story generation is requested",
  ];

  if (facts.setting.primarySetting?.toLowerCase() === "college") {
    forbidden.push(
      "Do not move the story to a café unless explicitly requested"
    );
  }

  for (const c of requiredCharacters) {
    forbidden.push(`Do not replace ${c.displayName || c.name}`);
  }

  return storyGenerationContractSchema.parse({
    operation: params.operation,
    requiredCharacters,
    requiredSetting: facts.setting.primarySetting,
    requiredLanguage: facts.language.storyLanguage,
    requiredFormat: {
      characterNameCase: facts.formatRules.uppercaseCharacterNames
        ? "upper"
        : "as_is",
      emotionBracketFormat: facts.formatRules.emotionInBrackets,
      dialoguePlacement: facts.formatRules.dialogueOnNextLine
        ? "next_line"
        : "any",
      sceneDivision: facts.formatRules.sceneDivisions,
      episodeHeading: facts.formatRules.episodeStructure,
    },
    requiredContinuityFacts: [
      facts.relationshipDynamic,
      facts.storyPremise,
    ].filter(Boolean) as string[],
    forbiddenSubstitutions: forbidden,
    latestInstruction: params.latestInstruction.slice(0, 500),
    storyStatus: facts.storyStatus,
  });
}

/** Explicit constraint block for prompts — never vague "remember preferences". */
export function serializeGenerationContract(
  contract: StoryGenerationContract
): string {
  const required: string[] = [];
  for (const c of contract.requiredCharacters) {
    required.push(
      `Main ${c.role || "character"}: ${c.displayName || c.name}`
    );
  }
  if (contract.requiredSetting) {
    required.push(`Primary setting: ${contract.requiredSetting.toUpperCase()}`);
  }
  if (contract.requiredLanguage) {
    required.push(`Story language: ${contract.requiredLanguage.toUpperCase()}`);
  }
  if (contract.requiredFormat.characterNameCase === "upper") {
    required.push("Character names must be uppercase");
  }
  if (contract.requiredFormat.emotionBracketFormat) {
    required.push(
      "Emotion must appear in brackets immediately after the character name"
    );
  }
  if (contract.requiredFormat.dialoguePlacement === "next_line") {
    required.push("Dialogue must appear on the next line");
  }
  if (contract.requiredFormat.sceneDivision) {
    required.push("Divide the episode into labeled scenes");
  }
  if (contract.requiredFormat.episodeHeading) {
    required.push("Include an episode heading when writing an episode");
  }

  return [
    "=== STORY GENERATION CONTRACT (MANDATORY) ===",
    "REQUIRED:",
    ...required.map((r) => `- ${r}`),
    "FORBIDDEN:",
    ...contract.forbiddenSubstitutions.map((f) => `- ${f}`),
    `LATEST INSTRUCTION: ${contract.latestInstruction}`,
    `STORY STATUS: ${contract.storyStatus}`,
    "=== END CONTRACT ===",
  ].join("\n");
}
