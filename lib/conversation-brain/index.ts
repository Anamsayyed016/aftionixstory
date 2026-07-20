/**
 * Conversation Brain — safe exports (planner, memory search, tools, types, Phase A/B).
 * Server Actions that run turns must import from `@/lib/conversation-brain/server`.
 */

export {
  planConversationTurn,
  planConversationTurnAsync,
  shouldUseLlmIntentClassifier,
  storyIntentToBrainIntent,
} from "@/lib/conversation-brain/planner";
export {
  routeStoryIntent,
  routeStoryIntentSync,
} from "@/lib/conversation-brain/intent-router";
export {
  STORY_INTENTS,
  storyIntentSchema,
  intentRouteResultSchema,
  storyIntentToOperation,
  type StoryIntent,
  type IntentRouteResult,
} from "@/lib/conversation-brain/intents";
export { buildIntentContext } from "@/lib/conversation-brain/intent-context";
export {
  isIntentClassifierEnabled,
  getIntentConfidenceThreshold,
} from "@/lib/conversation-brain/intent-classifier";
export { searchMemory } from "@/lib/conversation-brain/memory-search";
export {
  BRAIN_TOOL_REGISTRY,
  executeBrainTools,
  type BrainToolCall,
  type BrainToolName,
  type BrainToolResult,
} from "@/lib/conversation-brain/tools";
export {
  BRAIN_INTENTS,
  BRAIN_VERSION,
  type BrainIntent,
  type ConversationTurnRequest,
  type ConversationTurnResult,
  type TurnPlan,
} from "@/lib/conversation-brain/types";
export {
  DEFAULT_CONVERSATION_FLOW,
  mergeConversationFlow,
  normalizeOffers,
  offersToSuggestions,
  readConversationFlow,
  type ConversationFlow,
  type ConversationOffer,
} from "@/lib/conversation-brain/collaboration-state";
export {
  resolveAwaitingAnswer,
  resolveOfferSelection,
} from "@/lib/conversation-brain/offer-resolver";
export {
  detectOpenConcept,
  looksLikeWizardChecklist,
  COLLABORATIVE_FAILURE_USER_MESSAGE,
} from "@/lib/conversation-brain/open-concept";
