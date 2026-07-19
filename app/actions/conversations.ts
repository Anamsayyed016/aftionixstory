"use server";

import { Prisma } from "@prisma/client";

import {
  AuthzError,
  authzToActionError,
  requireAuthenticatedUser,
  requireStoryOwnership,
} from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  ConversationAccessError,
  appendOwnedChatMessage,
  archiveOwnedConversation,
  createOwnedConversation,
  findLatestActiveConversation,
  listOwnedConversations,
  loadOwnedConversationMessages,
  updateOwnedConversationState,
} from "@/lib/chat/conversations";
import {
  emptyContinueState,
  emptyCreateState,
  titleFromContinueStory,
} from "@/lib/chat/conversation-state";
import {
  appendChatMessageSchema,
  conversationIdSchema,
  createConversationSchema,
  listConversationsSchema,
  updateConversationStateSchema,
} from "@/lib/validations/conversation";

function mapError(error: unknown): ActionResult<never> {
  if (error instanceof ConversationAccessError) {
    return fail("NOT_FOUND", error.message);
  }
  if (error instanceof AuthzError) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
  if (error instanceof Error && error.message === "SYSTEM_ROLE_FORBIDDEN") {
    return fail("VALIDATION_ERROR", "Invalid message role.");
  }
  return fail("DATABASE_ERROR", "Something went wrong. Please try again.");
}

function serializeMessage(message: {
  id: string;
  role: string;
  content: string;
  status: string;
  requestId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}) {
  return {
    id: message.id,
    role: message.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
    content: message.content,
    status:
      message.status === "ERROR" ? ("error" as const) : ("sent" as const),
    createdAt: message.createdAt.toISOString(),
    requestId: message.requestId,
    metadata: message.metadata,
  };
}

export async function createConversationAction(
  input: unknown
): Promise<
  ActionResult<{
    conversationId: string;
    mode: "CREATE" | "CONTINUE";
    title: string | null;
    status: "ACTIVE" | "ARCHIVED";
    state: unknown;
  }>
> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = createConversationSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid conversation request.");
    }

    let storyTitle: string | null = null;
    if (parsed.data.mode === "CONTINUE") {
      const owned = await requireStoryOwnership(parsed.data.storyId!);
      storyTitle = owned.story.title;
    }

    const conversation = await createOwnedConversation({
      userId: user.id,
      mode: parsed.data.mode,
      storyId: parsed.data.mode === "CONTINUE" ? parsed.data.storyId : null,
      title:
        parsed.data.title ??
        (parsed.data.mode === "CONTINUE"
          ? titleFromContinueStory(storyTitle)
          : "New story idea"),
      state:
        parsed.data.mode === "CREATE"
          ? (emptyCreateState() as unknown as Prisma.InputJsonValue)
          : (emptyContinueState() as unknown as Prisma.InputJsonValue),
    });

    return ok({
      conversationId: conversation.id,
      mode: conversation.mode,
      title: conversation.title,
      status: conversation.status,
      state: conversation.state,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function listConversationsAction(
  input: unknown
): Promise<
  ActionResult<{
    conversations: Array<{
      id: string;
      mode: "CREATE" | "CONTINUE";
      title: string | null;
      status: "ACTIVE" | "ARCHIVED";
      storyId: string | null;
      storyTitle: string | null;
      lastMessageAt: string;
      lastMessagePreview: string | null;
    }>;
  }>
> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = listConversationsSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid list request.");
    }

    if (parsed.data.mode === "CONTINUE" && parsed.data.storyId) {
      await requireStoryOwnership(parsed.data.storyId);
    }

    const conversations = await listOwnedConversations({
      userId: user.id,
      mode: parsed.data.mode,
      storyId: parsed.data.storyId,
      limit: parsed.data.limit,
    });

    return ok({ conversations });
  } catch (error) {
    return mapError(error);
  }
}

export async function loadConversationAction(
  input: unknown
): Promise<
  ActionResult<{
    conversationId: string;
    mode: "CREATE" | "CONTINUE";
    title: string | null;
    status: "ACTIVE" | "ARCHIVED";
    storyId: string | null;
    storyTitle: string | null;
    storyStatus: string | null;
    state: unknown;
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      status: "sent" | "error";
      createdAt: string;
      requestId: string | null;
    }>;
  }>
> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = conversationIdSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid conversation id.");
    }

    const { conversation, messages } = await loadOwnedConversationMessages({
      userId: user.id,
      conversationId: parsed.data.conversationId,
    });

    return ok({
      conversationId: conversation.id,
      mode: conversation.mode,
      title: conversation.title,
      status: conversation.status,
      storyId: conversation.storyId,
      storyTitle: conversation.story?.title ?? null,
      storyStatus: conversation.story?.status ?? null,
      state: conversation.state,
      messages: messages
        .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
        .map(serializeMessage),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function ensureConversationAction(
  input: unknown
): Promise<
  ActionResult<{
    conversationId: string;
    mode: "CREATE" | "CONTINUE";
    title: string | null;
    status: "ACTIVE" | "ARCHIVED";
    state: unknown;
    created: boolean;
  }>
> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = createConversationSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid conversation request.");
    }

    if (parsed.data.mode === "CONTINUE") {
      await requireStoryOwnership(parsed.data.storyId!);
    }

    const existing = await findLatestActiveConversation({
      userId: user.id,
      mode: parsed.data.mode,
      storyId: parsed.data.storyId ?? null,
    });

    if (existing) {
      return ok({
        conversationId: existing.id,
        mode: existing.mode,
        title: existing.title,
        status: existing.status,
        state: existing.state,
        created: false,
      });
    }

    const created = await createConversationAction(parsed.data);
    if (!created.success) return created;
    return ok({ ...created.data, created: true });
  } catch (error) {
    return mapError(error);
  }
}

export async function appendChatMessageAction(
  input: unknown
): Promise<
  ActionResult<{
    message: {
      id: string;
      role: "user" | "assistant";
      content: string;
      status: "sent" | "error";
      createdAt: string;
      requestId: string | null;
    };
    duplicated: boolean;
    conversationStatus: "ACTIVE" | "ARCHIVED";
  }>
> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = appendChatMessageSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid message.");
    }

    // Never accept SYSTEM from client — schema already excludes it.
    const conversation = await loadOwnedConversationMessages({
      userId: user.id,
      conversationId: parsed.data.conversationId,
      limit: 1,
    });

    if (conversation.conversation.status === "ARCHIVED") {
      return fail(
        "CONVERSATION_ARCHIVED",
        "This conversation is archived. Start a new one to keep chatting."
      );
    }

    const result = await appendOwnedChatMessage({
      userId: user.id,
      conversationId: parsed.data.conversationId,
      role: parsed.data.role,
      content: parsed.data.content,
      status: parsed.data.status,
      requestId: parsed.data.requestId,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    });

    return ok({
      message: serializeMessage(result.message),
      duplicated: result.duplicated,
      conversationStatus: result.conversation.status,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function updateConversationStateAction(
  input: unknown
): Promise<ActionResult<{ conversationId: string; state: unknown }>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = updateConversationStateSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid conversation state.");
    }

    if (parsed.data.storyId) {
      await requireStoryOwnership(parsed.data.storyId);
    }

    const updated = await updateOwnedConversationState({
      userId: user.id,
      conversationId: parsed.data.conversationId,
      state: parsed.data.state as Prisma.InputJsonValue,
      title: parsed.data.title,
      storyId: parsed.data.storyId,
    });

    return ok({
      conversationId: updated.id,
      state: updated.state,
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function archiveConversationAction(
  input: unknown
): Promise<ActionResult<{ conversationId: string }>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = conversationIdSchema.safeParse(input);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid conversation id.");
    }

    const archived = await archiveOwnedConversation(
      user.id,
      parsed.data.conversationId
    );
    return ok({ conversationId: archived.id });
  } catch (error) {
    return mapError(error);
  }
}
