/**
 * Universal Intent Router — top-level classification + routing for Phase 1 chat.
 */

export {
  UNIVERSAL_INTENTS,
  isGeneralAiIntent,
  isStoryUniversalIntent,
  type UniversalIntent,
  type UniversalRouteDecision,
} from "@/lib/universal-router/intents";

export {
  classifyUniversalIntent,
  classifyUniversalIntentDeterministic,
  type ClassifyUniversalInput,
} from "@/lib/universal-router/classify";

export {
  runGeneralAiTurn,
  type GeneralAiTurnResult,
} from "@/lib/universal-router/general-handler";

export {
  MIRROR_USER_LANGUAGE_FRAGMENT,
  mirrorUserLanguageStyle,
} from "@/lib/universal-router/language-mirror";

export function isUniversalRouterEnabled(): boolean {
  const raw = (process.env.AI_UNIVERSAL_ROUTER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "";
}
