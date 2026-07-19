/**
 * Normalized Story Agent / AI operation error codes for logs + UI mapping.
 */
export type StoryAgentErrorCode =
  | "AGENT_RESPONSE_INVALID"
  | "CREATIVE_RESPONSE_EMPTY"
  | "CREATIVE_RESPONSE_TRUNCATED"
  | "MEMORY_PATCH_INVALID"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_AUTH_FAILED"
  | "MODEL_UNAVAILABLE"
  | "MESSAGE_PERSISTENCE_FAILED"
  | "CONVERSATION_STATE_FAILED"
  | "GENERATION_LIMIT_REACHED"
  | "CONTEXT_MISMATCH"
  | "CONTEXT_ISOLATION_ERROR"
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
  const creative =
    operation === "write_scene" ||
    operation === "revise_draft" ||
    operation === "start_story" ||
    operation === "generate_episode" ||
    operation === "continue_episode";

  switch (code) {
    case "PROVIDER_RATE_LIMITED":
      return "Thoda wait karein — bahut requests aa gayi hain. Phir try karein. 🙂";
    case "PROVIDER_QUOTA_EXCEEDED":
    case "GENERATION_LIMIT_REACHED":
      return "Is month ki generation limit poori ho chuki hai. Baad mein try karein.";
    case "PROVIDER_TIMEOUT":
      return creative
        ? "I couldn’t complete that scene in time. Your previous draft is safe—please retry."
        : "I couldn’t finish that reply in time. Please try once more. 🙂";
    case "CREATIVE_RESPONSE_EMPTY":
    case "CREATIVE_RESPONSE_TRUNCATED":
      return "I couldn’t complete that scene correctly. Your previous draft is safe—please retry.";
    case "AGENT_RESPONSE_INVALID":
    case "MEMORY_PATCH_INVALID":
      return "I couldn’t finish that reply. Please try once more. 🙂";
    case "PROVIDER_AUTH_FAILED":
    case "MODEL_UNAVAILABLE":
      return "The story assistant isn’t fully configured right now. Please try again later.";
    case "MESSAGE_PERSISTENCE_FAILED":
    case "CONVERSATION_STATE_FAILED":
      return "Reply generate hua, lekin save nahi ho paya. Please retry.";
    case "CONTEXT_MISMATCH":
      return "Generated scene didn’t match your requested characters. Previous draft is unchanged—please retry.";
    case "CONTEXT_ISOLATION_ERROR":
      return "That draft belonged to another chat. Please retry in this conversation.";
    default:
      return creative
        ? operation === "revise_draft"
          ? "I couldn’t apply that change, so I kept the earlier draft unchanged."
          : "I couldn’t complete that scene correctly. Your previous draft is safe—please retry."
        : "I couldn’t finish that reply. Please try once more. 🙂";
  }
}
