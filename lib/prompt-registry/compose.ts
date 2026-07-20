/**
 * Compose a PromptResult from layers (Phase E).
 */

import type { PromptId } from "@/lib/prompt-registry/ids";
import { defaultHints } from "@/lib/prompt-registry/provider-hints";
import type {
  PromptDefinition,
  PromptOutputMode,
  PromptRequest,
  PromptResult,
} from "@/lib/prompt-registry/types";
import { estimateTokensApprox } from "@/lib/prompt-registry/layers";

export function composePromptResult(params: {
  def: PromptDefinition;
  request: PromptRequest;
  system: string;
  user: string;
  includedSections: string[];
  conflictResolutions?: string[];
  outputMode?: PromptOutputMode;
}): PromptResult {
  const outputMode = params.outputMode ?? params.def.outputMode;
  const version =
    params.request.metadata?.promptVersionOverride || params.def.version;
  const messages = [
    { role: "system" as const, content: params.system.trim() },
    { role: "user" as const, content: params.user.trim() },
  ];
  const estimated = estimateTokensApprox(
    messages.map((m) => m.content).join("\n")
  );

  return {
    promptId: params.def.id,
    promptVersion: version,
    outputMode,
    messages,
    providerHints: defaultHints({
      temperatureProfile: params.def.temperatureProfile,
      maxOutputTokensProfile: params.def.maxOutputTokensProfile,
      reasoningProfile: params.def.reasoningProfile ?? "none",
      jsonMode: outputMode === "json" || params.def.jsonMode === "required",
    }),
    debug: {
      includedSections: params.includedSections,
      estimatedPromptTokens: estimated,
      conflictResolutions: params.conflictResolutions,
    },
  };
}

export function emptyDynamicFallback(
  operation: string,
  userMessage: string
): PromptResult {
  return {
    promptId: "conversation.normal" as PromptId,
    promptVersion: "1.0.0",
    outputMode: "text",
    messages: [
      {
        role: "system",
        content:
          "You are StoryVerse. Answer the user helpfully and briefly. Plain text only.",
      },
      {
        role: "user",
        content: `Operation: ${operation}\n\n${userMessage}`,
      },
    ],
    providerHints: defaultHints({
      temperatureProfile: "balanced",
      maxOutputTokensProfile: "medium",
      jsonMode: false,
    }),
    debug: {
      includedSections: [],
      estimatedPromptTokens: estimateTokensApprox(userMessage) + 40,
    },
  };
}

/** Convert registry result to legacy { system, prompt } shape. */
export function promptResultToLegacyParts(result: PromptResult): {
  system: string;
  prompt: string;
  promptId: PromptId;
  promptVersion: string;
} {
  const system =
    result.messages.find((m) => m.role === "system")?.content || "";
  const prompt =
    result.messages.find((m) => m.role === "user")?.content ||
    result.messages
      .filter((m) => m.role !== "system")
      .map((m) => m.content)
      .join("\n\n");
  return {
    system,
    prompt,
    promptId: result.promptId,
    promptVersion: result.promptVersion,
  };
}
