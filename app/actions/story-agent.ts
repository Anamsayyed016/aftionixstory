"use server";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  mapStoryAgentTurnError,
  runStoryAgentTurn,
  storyAgentTurnInputSchema,
  type StoryAgentTurnActionData,
} from "@/lib/story-agent/run-turn";

export type { StoryAgentTurnActionData } from "@/lib/story-agent/run-turn";

/**
 * Canonical Story Agent turn — operation-routed orchestration.
 * Thin Server Action wrapper: auth + validate + delegate to the shared
 * `runStoryAgentTurn` orchestration (also used by the streaming Route
 * Handler at app/api/chat/stream/route.ts).
 */
export async function storyAgentTurnAction(
  input: unknown
): Promise<ActionResult<StoryAgentTurnActionData>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = storyAgentTurnInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Please enter a valid message.");
    }

    const data = await runStoryAgentTurn({
      userId: user.id,
      ...parsed.data,
    });
    return ok(data);
  } catch (error) {
    return mapStoryAgentTurnError(error);
  }
}
