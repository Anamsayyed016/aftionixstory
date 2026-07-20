/**
 * Instruction Fidelity — public exports (Phase G.5).
 */

export { isInstructionFidelityEnabled } from "@/lib/story-fidelity/feature-flag";
export * from "@/lib/story-fidelity/contracts";
export {
  resolveStoryFacts,
  extractExplicitFactsFromMessage,
  readFidelityState,
  writeFidelityState,
} from "@/lib/story-fidelity/resolve-facts";
export { lockField, isFieldLocked } from "@/lib/story-fidelity/locked-facts";
export {
  shouldAskQuestion,
  shouldSuppressClarification,
  detectQuestionKeysInText,
} from "@/lib/story-fidelity/answered-questions";
export { evaluateStoryReadiness } from "@/lib/story-fidelity/readiness-gate";
export {
  buildStoryGenerationContract,
  serializeGenerationContract,
} from "@/lib/story-fidelity/generation-contract";
export { validateStoryOutput } from "@/lib/story-fidelity/output-validator";
export { validateLanguageFidelity } from "@/lib/story-fidelity/language-validator";
export { validateFormatFidelity } from "@/lib/story-fidelity/format-validator";
export {
  buildRepairPromptParts,
  summarizeValidationForLogs,
} from "@/lib/story-fidelity/repair";
export { applyInstructionFidelityPreTurn } from "@/lib/story-fidelity/brain-adapter";
export {
  appendContractToPrompt,
  enforceInstructionFidelityOnDraft,
} from "@/lib/story-fidelity/generate-with-fidelity";
