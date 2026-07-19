import "server-only";

export type AiLogFields = {
  requestId?: string;
  provider?: string;
  model?: string;
  code?: string;
  httpStatus?: number;
  retryCount?: number;
  durationMs?: number;
  operation?: string;
  keyPresent?: boolean;
  timestamp?: string;
  [key: string]: string | number | boolean | undefined;
};

const SECRET_KEYS = /api[_-]?key|authorization|secret|password|token|prompt|content|message/i;

function sanitize(fields: AiLogFields): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    timestamp: fields.timestamp ?? new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || key === "timestamp") continue;
    if (SECRET_KEYS.test(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

/** Safe structured logger for AI provider diagnostics. Never logs prompts or keys. */
export function logAiEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: AiLogFields = {}
) {
  const payload = { event, ...sanitize(fields) };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function logAiProviderFailure(fields: {
  requestId: string;
  provider: string;
  model: string;
  code: string;
  httpStatus?: number;
  retryCount: number;
  durationMs: number;
  operation: string;
}) {
  logAiEvent("error", "ai.provider_failure", fields);
}
