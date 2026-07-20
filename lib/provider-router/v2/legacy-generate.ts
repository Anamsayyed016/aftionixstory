/**
 * Shared helper: route legacy generateText calls through Provider Router v2
 * when enabled, preserving optional provider overrides for tests.
 */

import "server-only";

import { generateWithFailover } from "@/lib/ai/failover";
import { getAIProvider } from "@/lib/ai/registry";
import type {
  AIProvider,
  GenerateTextInput,
  GenerateTextResult,
} from "@/lib/ai/types";
import type { FailoverModelKind } from "@/lib/ai/failover";
import { isProviderRouterV2Enabled } from "@/lib/provider-router/v2/feature-flag";

export async function generateTextCompat(params: {
  input: Omit<GenerateTextInput, "model"> & { model?: string };
  modelKind?: FailoverModelKind;
  provider?: AIProvider;
  turnRequestId?: string;
}): Promise<GenerateTextResult & { failoverUsed?: boolean }> {
  if (params.provider) {
    const result = await params.provider.generateText(params.input);
    return { ...result, failoverUsed: false };
  }

  if (isProviderRouterV2Enabled()) {
    return generateWithFailover({
      input: params.input,
      modelKind: params.modelKind ?? "agent",
      turnRequestId: params.turnRequestId,
    });
  }

  const provider = getAIProvider();
  const result = await provider.generateText(params.input);
  return { ...result, failoverUsed: false };
}
