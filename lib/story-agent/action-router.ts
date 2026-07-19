import "server-only";

import { createStoryAction } from "@/app/actions/stories";
import { saveEpisodeAction } from "@/app/actions/episodes";
import { generateEpisodeDraft } from "@/lib/ai/services/generate-episode";
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
                label: "Suggest opening scenes",
                prompt: "Suggest three opening situations.",
              },
              {
                label: "Deepen characters",
                prompt: "Help me deepen the main characters.",
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
          message: `Still need a bit more before creating: ${missing.join(", ")}.`,
        },
      };
    }

    const candidate = memoryToWizardCandidate(memory);
    // Soft defaults already applied in memoryToWizardCandidate
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
            "I still need a clearer title, genre, language, or main character before creating the story.",
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

  if (
    actionType === "generate_episode" ||
    actionType === "revise_draft"
  ) {
    if (params.generationBlocked) {
      return {
        memory,
        result: {
          type: actionType,
          ok: false,
          message:
            "Understood — I won’t start writing yet. Say “start now” when you’re ready.",
        },
      };
    }

    const storyId = params.storyId;
    if (!storyId) {
      return {
        memory,
        result: {
          type: actionType,
          ok: false,
          message:
            "We need a created story first. Say “create the story” when the setup feels ready.",
        },
      };
    }

    const action =
      actionType === "revise_draft" ? "REGENERATE" : "NEW_EPISODE";
    const instruction =
      typeof params.decision.action.payload?.instruction === "string" &&
      params.decision.action.payload.instruction.trim()
        ? String(params.decision.action.payload.instruction)
        : params.userMessage;

    try {
      const draft = await generateEpisodeDraft({
        userId: params.userId,
        storyId,
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
      const message =
        error instanceof Error
          ? error.message
          : "Could not generate the episode draft.";
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
          message: "There is no unsaved episode draft to save yet.",
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
