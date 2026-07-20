/**
 * Latest-draft inclusion and truncation (Phase D).
 */

import type { OperationProfile } from "@/lib/context-builder/v2/profiles";
import type { ContextLimits, DynamicContext } from "@/lib/context-builder/v2/schema";
import type { StoryMemoryV2 } from "@/lib/story-memory/v2";

export function selectLatestDraft(
  memory: StoryMemoryV2,
  profile: OperationProfile,
  limits: ContextLimits
): {
  latestDraft: DynamicContext["latestDraft"];
  truncated: boolean;
} {
  if (!profile.includeLatestDraft || limits.maxDraftChars <= 0) {
    return { latestDraft: null, truncated: false };
  }
  const draft = memory.latestDraft;
  if (!draft?.content?.trim()) {
    return { latestDraft: null, truncated: false };
  }

  const content = draft.content;
  const max = limits.maxDraftChars;

  if (content.length <= max) {
    return {
      latestDraft: {
        title: draft.title,
        content,
        wordCount: draft.wordCount,
        truncated: false,
        strategy: "full",
      },
      truncated: false,
    };
  }

  if (profile.preferDraftEnding) {
    // Keep ending for continuation
    const ending = content.slice(-Math.floor(max * 0.85));
    const head = content.slice(0, Math.floor(max * 0.15));
    return {
      latestDraft: {
        title: draft.title,
        content: `${head}\n\n…[truncated]…\n\n${ending}`,
        wordCount: draft.wordCount,
        truncated: true,
        strategy: "ending",
      },
      truncated: true,
    };
  }

  // Begin + end for rewrite
  const half = Math.floor(max / 2) - 20;
  return {
    latestDraft: {
      title: draft.title,
      content: `${content.slice(0, half)}\n\n…[truncated]…\n\n${content.slice(-half)}`,
      wordCount: draft.wordCount,
      truncated: true,
      strategy: "begin_end",
    },
    truncated: true,
  };
}
