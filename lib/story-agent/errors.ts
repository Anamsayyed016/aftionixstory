/**
 * Normalized Story Agent / AI operation error codes for logs + UI mapping.
 * Prefer these exact codes — do not collapse everything into UNKNOWN_AI_ERROR.
 */
export type StoryAgentErrorCode =
  | "DETERMINISTIC_PARSE_FAILED"
  | "INTENT_ROUTING_FAILED"
  | "PROVIDER_CONFIG_INVALID"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "MODEL_UNAVAILABLE"
  | "REQUEST_PARAMETER_INVALID"
  | "STRUCTURED_RESPONSE_INVALID"
  | "AGENT_RESPONSE_INVALID"
  | "CREATIVE_RESPONSE_EMPTY"
  | "CREATIVE_RESPONSE_TRUNCATED"
  | "MEMORY_UPDATE_FAILED"
  | "MEMORY_PATCH_INVALID"
  | "MESSAGE_PERSISTENCE_FAILED"
  | "CONVERSATION_STATE_FAILED"
  | "ALL_PROVIDERS_FAILED"
  | "GENERATION_LIMIT_REACHED"
  | "CONTEXT_MISMATCH"
  | "CONTEXT_ISOLATION_ERROR"
  | "INSTRUCTION_FIDELITY_FAILED"
  | "UNKNOWN_AI_ERROR";

export class StoryAgentError extends Error {
  code: StoryAgentErrorCode;
  retryable: boolean;
  operation?: string;

  constructor(
    code: StoryAgentErrorCode,
    message: string,
    opts?: { retryable?: boolean; operation?: string }
  ) {
    super(message);
    this.name = "StoryAgentError";
    this.code = code;
    this.retryable = opts?.retryable ?? true;
    this.operation = opts?.operation;
  }
}

export function isStoryAgentError(error: unknown): error is StoryAgentError {
  return error instanceof StoryAgentError;
}

/** User-facing copy by operation family — never expose internal codes. */
export function friendlyMessageForCode(
  code: StoryAgentErrorCode,
  operation?: string
): string {
  const isBrainstorm =
    operation === "brainstorm" || operation === "suggest_options";
  const isCreative =
    operation === "write_scene" ||
    operation === "revise_draft" ||
    operation === "start_story" ||
    operation === "generate_episode" ||
    operation === "continue_episode";
  const isMemory =
    operation === "memory_update" || operation === "inspect_memory";

  switch (code) {
    case "PROVIDER_RATE_LIMITED":
      return "Thoda wait karein — bahut requests aa gayi hain. Phir try karein. 🙂";
    case "PROVIDER_QUOTA_EXCEEDED":
    case "GENERATION_LIMIT_REACHED":
      return "Is month ki generation limit poori ho chuki hai. Baad mein try karein.";
    case "PROVIDER_TIMEOUT":
      if (isBrainstorm) {
        return "I couldn’t generate the ideas right now. Please retry once.";
      }
      if (isCreative) {
        return "I couldn’t generate that scene right now. Your story setup is saved—please retry shortly.";
      }
      return "I couldn’t finish that reply in time. Please try once more. 🙂";
    case "CREATIVE_RESPONSE_EMPTY":
    case "CREATIVE_RESPONSE_TRUNCATED":
      return "I couldn’t generate that scene right now. Your story setup is saved—please retry shortly.";
    case "STRUCTURED_RESPONSE_INVALID":
    case "AGENT_RESPONSE_INVALID":
      if (isBrainstorm) {
        return "I couldn’t generate the ideas right now. Please retry once.";
      }
      if (isMemory) {
        return "I couldn’t save that story detail. Please try once more.";
      }
      return "I couldn’t finish that reply. Please try once more. 🙂";
    case "MEMORY_UPDATE_FAILED":
    case "MEMORY_PATCH_INVALID":
    case "DETERMINISTIC_PARSE_FAILED":
      return "I couldn’t save that story detail. Please try once more.";
    case "PROVIDER_AUTH_FAILED":
    case "PROVIDER_CONFIG_INVALID":
    case "MODEL_UNAVAILABLE":
      return "The story assistant isn’t fully configured right now. Please try again later.";
    case "REQUEST_PARAMETER_INVALID":
      return "That request couldn’t be sent correctly. Please try again—if it keeps failing, contact support.";
    case "PROVIDER_UNAVAILABLE":
    case "ALL_PROVIDERS_FAILED":
      if (isBrainstorm) {
        return "I couldn’t generate the ideas right now. Please retry once.";
      }
      if (isCreative) {
        return "I couldn’t generate that scene right now. Your story setup is saved—please retry shortly.";
      }
      return "I couldn’t finish that reply. Please try once more. 🙂";
    case "MESSAGE_PERSISTENCE_FAILED":
    case "CONVERSATION_STATE_FAILED":
      return "Reply generate hua, lekin save nahi ho paya. Please retry.";
    case "CONTEXT_MISMATCH":
      return "That draft didn’t stay true to your characters and story setup. Nothing was overwritten—try again, or say “write a scene” when you’re ready.";
    case "CONTEXT_ISOLATION_ERROR":
      return "That draft belonged to another chat. Please retry in this conversation.";
    case "INSTRUCTION_FIDELITY_FAILED":
      return "I couldn’t generate this episode while preserving your confirmed characters and format. Please try once more.";
    case "INTENT_ROUTING_FAILED":
      return "I couldn’t finish that reply. Please try once more. 🙂";
    default:
      if (isBrainstorm) {
        return "I couldn’t generate the ideas right now. Please retry once.";
      }
      if (isCreative) {
        return "I couldn’t generate that scene right now. Your story setup is saved—please retry shortly.";
      }
      if (operation === "revise_draft") {
        return "I couldn’t apply that change, so I kept the earlier draft unchanged.";
      }
      return "I couldn’t finish that reply. Please try once more. 🙂";
  }
}

/** Never surface raw StoryAgentError / internal validator strings in chat. */
export function userFacingStoryAgentMessage(
  error: unknown,
  operation?: string
): string {
  if (isStoryAgentError(error)) {
    return friendlyMessageForCode(error.code, operation ?? error.operation);
  }
  return friendlyMessageForCode("UNKNOWN_AI_ERROR", operation);
}
