/**
 * Provider gateway for Conversation Brain.
 *
 * Create-chat generation must go through this module.
 * Business/UI code must never import OpenAI/Gemini SDKs.
 *
 * Phase F: when AI_PROVIDER_ROUTER_V2_ENABLED, routes via unified gateway.
 */

import "server-only";

import { generateWithFailover } from "@/lib/ai/failover";
import type { GenerateTextInput, GenerateTextResult } from "@/lib/ai/types";
import type { FailoverModelKind } from "@/lib/ai/failover";
import { StoryAgentError } from "@/lib/story-agent/errors";
import {
  buildGenerationRequestFromSystemPrompt,
  generate as gatewayGenerate,
  generationResultToLegacyText,
  isProviderError,
  isProviderRouterV2Enabled,
  userFacingGenerationMessage,
} from "@/lib/provider-router/v2";

export type BrainGenerateParams = {
  input: Omit<GenerateTextInput, "model"> & { model?: string };
  modelKind?: FailoverModelKind;
  turnRequestId?: string;
  conversationId?: string;
  promptId?: string;
  promptVersion?: string;
  intent?: string;
};

/**
 * Sole provider entry for Conversation Brain turns.
 */
export async function generateViaBrain(
  params: BrainGenerateParams
): Promise<
  GenerateTextResult & {
    failoverUsed: boolean;
    promptId?: string;
    promptVersion?: string;
  }
> {
  if (!isProviderRouterV2Enabled()) {
    return generateWithFailover({
      input: params.input,
      modelKind: params.modelKind ?? "agent",
      turnRequestId: params.turnRequestId,
    });
  }

  try {
    const request = buildGenerationRequestFromSystemPrompt({
      system: params.input.systemInstruction,
      prompt: params.input.prompt,
      operation: params.input.operation || "brain_generate",
      outputMode: params.input.outputMode,
      turnRequestId: params.turnRequestId,
      conversationId: params.conversationId,
      promptId: params.promptId,
      promptVersion: params.promptVersion,
      temperature: params.input.temperature,
      maxOutputTokens: params.input.maxOutputTokens,
      modelKind: params.modelKind ?? "agent",
      intent: params.intent,
    });

    // Prefer explicit model override for classifier when provided
    if (params.input.model?.trim()) {
      request.routing = {
        ...request.routing,
        // keep selection free; model profile still applies unless we pass through
      };
    }

    const result = await gatewayGenerate(request, {
      parentSignal: params.input.signal,
    });
    return generationResultToLegacyText(result);
  } catch (error) {
    if (isProviderError(error)) {
      throw new StoryAgentError(
        error.code === "PROVIDER_TIMEOUT"
          ? "PROVIDER_TIMEOUT"
          : error.code === "PROVIDER_RATE_LIMITED"
            ? "PROVIDER_RATE_LIMITED"
            : error.code === "PROVIDER_AUTH_FAILED" ||
                error.code === "PROVIDER_NOT_CONFIGURED"
              ? "PROVIDER_AUTH_FAILED"
              : "PROVIDER_UNAVAILABLE",
        userFacingGenerationMessage(params.input.operation || "brain"),
        {
          retryable: error.retryable,
          operation: params.input.operation,
        }
      );
    }
    throw error;
  }
}
