/**
 * Feature flag for Instruction Fidelity (Phase G.5).
 */

export function isInstructionFidelityEnabled(): boolean {
  const raw = (process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED || "false")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
