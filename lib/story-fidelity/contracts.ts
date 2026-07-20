/**
 * Public contracts re-exports (Phase G.5).
 */

export type {
  ResolvedStoryFacts,
  StoryGenerationContract,
  StoryReadinessResult,
  StoryValidationResult,
  InstructionFidelityState,
  AnsweredQuestion,
  QuestionKey,
} from "@/lib/story-fidelity/schemas";

export {
  resolvedStoryFactsSchema,
  storyGenerationContractSchema,
  storyValidationResultSchema,
  instructionFidelityStateSchema,
  SAFE_GENERATION_FAILURE_MESSAGE,
} from "@/lib/story-fidelity/schemas";
