/**
 * Parse and validate ToolRequest payloads from AI planners.
 */

import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import {
  toolRequestSchema,
  toolRequestsEnvelopeSchema,
  type ToolRequest,
} from "@/lib/tools/schemas";

export function parseToolRequest(raw: unknown): ToolRequest {
  return toolRequestSchema.parse(raw);
}

export function parseToolRequests(raw: unknown): ToolRequest[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => toolRequestSchema.parse(item));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.toolRequests)) {
      return toolRequestsEnvelopeSchema.parse(obj).toolRequests;
    }
    if (typeof obj.toolId === "string") {
      return [toolRequestSchema.parse(obj)];
    }
  }
  throw new Error("Invalid ToolRequest payload");
}

export function parseToolRequestsFromText(text: string): {
  requests: ToolRequest[];
  assistantReply?: string;
} {
  const json = extractJsonObject(text);
  if (Array.isArray(json)) {
    return { requests: parseToolRequests(json) };
  }
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.toolRequests)) {
      const env = toolRequestsEnvelopeSchema.parse(obj);
      return {
        requests: env.toolRequests,
        assistantReply: env.assistantReply,
      };
    }
    if (typeof obj.toolId === "string") {
      return { requests: [toolRequestSchema.parse(obj)] };
    }
  }
  throw new Error("Could not parse ToolRequest JSON");
}

export function safeParseToolRequestsFromText(text: string): {
  ok: true;
  requests: ToolRequest[];
  assistantReply?: string;
} | {
  ok: false;
  error: string;
} {
  try {
    const parsed = parseToolRequestsFromText(text);
    return { ok: true, ...parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "parse_failed",
    };
  }
}
