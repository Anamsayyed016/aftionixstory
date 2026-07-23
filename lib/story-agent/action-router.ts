import "server-only";

import { createStoryAction } from "@/app/actions/stories";
import { saveEpisodeAction } from "@/app/actions/episodes";
import {
  hasUsableWritingContext,
} from "@/lib/ai/services/conversational-draft";
import { generateEpisodeDraft } from "@/lib/ai/services/generate-episode";
import { generateWriteScene } from "@/lib/ai/services/write-scene";
import type { CanonicalStoryContext } from "@/lib/story-agent/canonical-story-context";
import {
  friendlyMessageForCode,
  isStoryAgentError,
} from "@/lib/story-agent/errors";
import {
  getMissingCreateFields,
  memoryToWizardCandidate,
} from "@/lib/story-agent/memory-patch";
import type {
  StoryAgentActionType,
  StoryAgentTurnResult,
  StoryMemory,
} from "@/lib/story-agent/schema";
import { createStoryWizardSchema } from "@/lib/validations/story";

export type ActionRouterResult = {
  type: StoryAgentActionType;
  ok: boolean;
  message?: string;
  storyId?: string;
  showReview?: boolean;
  draft?: {
    title: string;
    content: string;
    wordCount: number;
    clientRequestId: string;
    action: string;
    replaceEpisodeId?: string;
  };
  suggestions?: Array<{ label: string; prompt: string }>;
  data?: unknown;
  clarificationOnly?: boolean;
};

export async function routeStoryAgentAction(params: {
  userId: string;
  conversationId: string;
  storyId: string | null;
  memory: StoryMemory;
  decision: StoryAgentTurnResult;
  userMessage: string;
  turnRequestId: string;
  generationBlocked: boolean;
  canonicalStoryContext?: CanonicalStoryContext;
}): Promise<{ memory: StoryMemory; result: ActionRouterResult }> {
  const actionType = params.decision.action?.type ?? "none";
  let memory = params.memory;

  if (actionType === "none" || actionType === "suggest_options") {
    const suggestions =
      params.decision.suggestions?.length > 0
        ? params.decision.suggestions
        : actionType === "suggest_options"
          ? [
              {
                label: "Suggest 3 concepts",
                prompt: "Suggest three unique story concepts for me.",
              },
              {
                label: "I have a character",
                prompt: "I have a character idea to start with.",
              },
            ]
          : params.decision.suggestions;

    return {
      memory,
      result: {
        type: actionType,
        ok: true,
        suggestions,
      },
    };
  }

  if (actionType === "show_review") {
    return {
      memory,
      result: { type: "show_review", ok: true, showReview: true },
    };
  }

  if (actionType === "create_story") {
    const missing = getMissingCreateFields(memory);
    if (missing.length > 0) {
      return {
        memory,
        result: {
          type: "create_story",
          ok: false,
          message:
            "Almost ready to save — I still need a clearer title feel, genre vibe, language, or main character name before creating the Story record.",
        },
      };
    }

    const candidate = memoryToWizardCandidate(memory);
    const wizard = createStoryWizardSchema.safeParse({
      ...candidate,
      status: "ACTIVE",
      visibility: "PRIVATE",
    });
    if (!wizard.success) {
      return {
        memory,
        result: {
          type: "create_story",
          ok: false,
          message:
            "I can keep drafting with you — when you want the Story saved, give me at least a title feel and one named character.",
        },
      };
    }

    const created = await createStoryAction(wizard.data);
    if (!created.success) {
      return {
        memory,
        result: {
          type: "create_story",
          ok: false,
          message: created.error.message,
        },
      };
    }

    memory = {
      ...memory,
      storyMemory: {
        ...memory.storyMemory,
        storyStatus: "created",
        title: wizard.data.title,
      },
      updatedAt: new Date().toISOString(),
    };

    return {
      memory,
      result: {
        type: "create_story",
        ok: true,
        storyId: created.data.storyId,
        message: "Story created.",
      },
    };
  }

  if (actionType === "generate_episode" || actionType === "revise_draft") {
    if (params.generationBlocked) {
      return {
        memory,
        result: {
          type: actionType,
          ok: false,
          message:
            "Understood — I won’t start writing yet. Say “start the story” when you’re ready.",
        },
      };
    }

    const instruction =
      typeof params.decision.action.payload?.instruction === "string" &&
      params.decision.action.payload.instruction.trim()
        ? String(params.decision.action.payload.instruction)
        : params.userMessage;

    // Path A: no Story yet — conversational opening draft into latestDraft
    if (!params.storyId) {
      if (
        !hasUsableWritingContext(memory) &&
        !params.canonicalStoryContext?.characters.length
      ) {
        return {
          memory,
          result: {
            type: actionType,
            ok: false,
            clarificationOnly: true,
            message:
              "Bilkul—kis type ki story start karun: romance, thriller, fantasy, ya main ek unique concept choose karun?",
          },
        };
      }

      try {
        // New-chat drafts must use the same Context Builder, Prompt Registry,
        // Provider Router, and relevance guard as every other creative write.
        // The legacy conversational draft path bypassed those layers entirely.
        const draft = await generateWriteScene({
          userId: params.userId,
          memory,
          userMessage: instruction,
          mode: actionType === "revise_draft" ? "revise" : "scene",
          conversationId: params.conversationId,
          storyId: null,
          intent: actionType === "revise_draft" ? "rewrite" : "write_scene",
          canonicalContext: params.canonicalStoryContext,
        });
        const clientRequestId = `ep_${params.turnRequestId}`;

        memory = {
          ...memory,
          latestDraft: {
            title: draft.title,
            content: draft.content,
            wordCount: draft.wordCount,
            clientRequestId,
            action: actionType === "revise_draft" ? "REGENERATE" : "NEW_EPISODE",
          },
          updatedAt: new Date().toISOString(),
        };

        return {
          memory,
          result: {
            type: actionType,
            ok: true,
            draft: {
              title: draft.title,
              content: draft.content,
              wordCount: draft.wordCount,
              clientRequestId,
              action: actionType === "revise_draft" ? "REGENERATE" : "NEW_EPISODE",
            },
          },
        };
      } catch (error) {
        const message = isStoryAgentError(error)
          ? friendlyMessageForCode(error.code, actionType)
          : "I couldn’t generate that scene correctly. Your story setup is saved—please retry.";
        return {
          memory,
          result: { type: actionType, ok: false, message },
        };
      }
    }

    // Path B: Story exists — reuse full episode pipeline
    const action =
      actionType === "revise_draft" ? "REGENERATE" : "NEW_EPISODE";

    try {
      const draft = await generateEpisodeDraft({
        userId: params.userId,
        storyId: params.storyId,
        userInstruction: instruction,
        action: action as "NEW_EPISODE" | "REGENERATE" | "CONTINUE",
        clientRequestId: `ep_${params.turnRequestId}`,
      });

      memory = {
        ...memory,
        latestDraft: {
          title: draft.title,
          content: draft.content,
          wordCount: draft.wordCount,
          clientRequestId: draft.clientRequestId,
          action: draft.action,
          replaceEpisodeId: draft.replaceEpisodeId,
        },
        updatedAt: new Date().toISOString(),
      };

      return {
        memory,
        result: {
          type: actionType,
          ok: true,
          draft: {
            title: draft.title,
            content: draft.content,
            wordCount: draft.wordCount,
            clientRequestId: draft.clientRequestId,
            action: draft.action,
            replaceEpisodeId: draft.replaceEpisodeId,
          },
        },
      };
    } catch (error) {
      const message = isStoryAgentError(error)
        ? friendlyMessageForCode(error.code, actionType)
        : "I couldn’t generate that episode correctly. Your previous draft is safe—please retry.";
      return {
        memory,
        result: { type: actionType, ok: false, message },
      };
    }
  }

  if (actionType === "save_episode") {
    const draft = memory.latestDraft;
    if (!draft?.content || !draft.clientRequestId || !params.storyId) {
      return {
        memory,
        result: {
          type: "save_episode",
          ok: false,
          message: !params.storyId
            ? "Create/save the Story first, then I can save this episode to it."
            : "There is no unsaved episode draft to save yet.",
        },
      };
    }

    const saved = await saveEpisodeAction({
      storyId: params.storyId,
      title: draft.title || "Untitled Episode",
      content: draft.content,
      clientRequestId: draft.clientRequestId,
      generationAction: draft.action,
      replaceEpisodeId:
        typeof draft.replaceEpisodeId === "string"
          ? draft.replaceEpisodeId
          : undefined,
    });

    if (!saved.success) {
      return {
        memory,
        result: {
          type: "save_episode",
          ok: false,
          message: saved.error.message,
        },
      };
    }

    memory = {
      ...memory,
      latestDraft: null,
      updatedAt: new Date().toISOString(),
    };

    return {
      memory,
      result: {
        type: "save_episode",
        ok: true,
        message: "Episode saved.",
        data: saved.data,
      },
    };
  }

  return {
    memory,
    result: { type: actionType, ok: true },
  };
}
