/**
 * Story readiness gate (Phase G.5).
 */

import { isCreativeStoryIntent } from "@/lib/conversation-brain/intents";
import type { ResolvedStoryFacts, StoryReadinessResult } from "@/lib/story-fidelity/schemas";
import { extractExplicitFactsFromMessage } from "@/lib/story-fidelity/resolve-facts";

export function evaluateStoryReadiness(params: {
  facts: ResolvedStoryFacts;
  userMessage: string;
  intent?: string | null;
}): StoryReadinessResult {
  const extracted = extractExplicitFactsFromMessage(params.userMessage);
  const intent = params.intent || "";
  const creative = isCreativeStoryIntent(intent as never) ||
    /write_|generate_|continue_story|rewrite|start/i.test(intent);

  const blocking: string[] = [];
  const optional: string[] = [];

  if (params.facts.conversationRules.doNotStartStoryYet && !extracted.startNow) {
    return {
      ready: false,
      mode: "planning_only",
      blockingReasons: ["do_not_start_story_yet"],
      missingOptionalFacts: optional,
      generationAllowed: false,
      resolvedFactsSnapshot: params.facts,
    };
  }

  if (extracted.startNow || intent === "write_episode" || intent === "write_scene") {
    // Only require facts the user made necessary (locked or present)
    // Do not over-block — missing genre is optional
    if (!params.facts.characters.mainMaleLead && !params.facts.characters.mainFemaleLead) {
      // Allow generation if user never set leads — but if they set one, expect both eventually
      optional.push("leads");
    }

    const mode = extracted.startNow
      ? "explicit_start"
      : intent === "continue_story"
        ? "continue"
        : intent.startsWith("rewrite") || intent === "rewrite"
          ? "rewrite"
          : "ready_to_write";

    return {
      ready: blocking.length === 0,
      mode,
      blockingReasons: blocking,
      missingOptionalFacts: optional,
      generationAllowed: blocking.length === 0,
      resolvedFactsSnapshot: params.facts,
    };
  }

  if (creative && params.facts.storyStatus === "planning") {
    return {
      ready: false,
      mode: "planning_only",
      blockingReasons: ["story_still_planning"],
      missingOptionalFacts: optional,
      generationAllowed: false,
      resolvedFactsSnapshot: params.facts,
    };
  }

  if (
    params.facts.storyStatus === "ready" ||
    params.facts.storyStatus === "writing"
  ) {
    return {
      ready: true,
      mode: "ready_to_write",
      blockingReasons: [],
      missingOptionalFacts: optional,
      generationAllowed: true,
      resolvedFactsSnapshot: params.facts,
    };
  }

  return {
    ready: false,
    mode: "planning_only",
    blockingReasons: [],
    missingOptionalFacts: optional,
    generationAllowed: false,
    resolvedFactsSnapshot: params.facts,
  };
}
