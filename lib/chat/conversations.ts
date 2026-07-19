import "server-only";

import type {
  ChatMessageRole,
  ChatMessageStatus,
  ConversationMode,
  ConversationStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  previewFromContent,
  titleFromContinueStory,
  titleFromCreateMessage,
} from "@/lib/chat/conversation-state";

export const HISTORY_LIMIT = 20;
export const MESSAGE_PAGE_LIMIT = 50;

export class ConversationAccessError extends Error {
  code = "NOT_FOUND" as const;
  constructor(message = "Conversation not found.") {
    super(message);
    this.name = "ConversationAccessError";
  }
}

export async function createOwnedConversation(params: {
  userId: string;
  mode: ConversationMode;
  storyId?: string | null;
  title?: string | null;
  state?: Prisma.InputJsonValue | null;
}) {
  return prisma.conversation.create({
    data: {
      userId: params.userId,
      mode: params.mode,
      storyId: params.storyId ?? null,
      title: params.title ?? null,
      status: "ACTIVE",
      state: params.state ?? undefined,
      lastMessageAt: new Date(),
    },
  });
}

export async function requireOwnedConversation(
  userId: string,
  conversationId: string
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      story: { select: { id: true, title: true, status: true } },
    },
  });
  if (!conversation) {
    throw new ConversationAccessError();
  }
  return conversation;
}

export async function listOwnedConversations(params: {
  userId: string;
  mode: ConversationMode;
  storyId?: string;
  limit?: number;
}) {
  const limit = params.limit ?? HISTORY_LIMIT;
  const rows = await prisma.conversation.findMany({
    where: {
      userId: params.userId,
      mode: params.mode,
      ...(params.storyId ? { storyId: params.storyId } : {}),
      status: { in: ["ACTIVE", "ARCHIVED"] },
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    include: {
      story: { select: { id: true, title: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, role: true },
      },
    },
  });

  return rows.map((row) => {
    const last = row.messages[0];
    return {
      id: row.id,
      mode: row.mode,
      title: row.title,
      status: row.status,
      storyId: row.storyId,
      storyTitle: row.story?.title ?? null,
      lastMessageAt: row.lastMessageAt.toISOString(),
      lastMessagePreview: last ? previewFromContent(last.content) : null,
      lastMessageRole: last?.role ?? null,
    };
  });
}

export async function loadOwnedConversationMessages(params: {
  userId: string;
  conversationId: string;
  limit?: number;
}) {
  const conversation = await requireOwnedConversation(
    params.userId,
    params.conversationId
  );

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: params.limit ?? MESSAGE_PAGE_LIMIT,
  });

  return { conversation, messages };
}

export async function appendOwnedChatMessage(params: {
  userId: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  status?: ChatMessageStatus;
  requestId?: string | null;
  metadata?: Prisma.InputJsonValue;
  titleIfEmpty?: string | null;
}) {
  if (params.role === "SYSTEM") {
    throw new Error("SYSTEM_ROLE_FORBIDDEN");
  }

  const conversation = await requireOwnedConversation(
    params.userId,
    params.conversationId
  );

  if (params.requestId) {
    const existing = await prisma.chatMessage.findFirst({
      where: {
        conversationId: conversation.id,
        requestId: params.requestId,
      },
    });
    if (existing) {
      return { conversation, message: existing, duplicated: true as const };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    try {
      const message = await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: params.role,
          content: params.content,
          status: params.status ?? "SENT",
          requestId: params.requestId ?? null,
          metadata: params.metadata ?? undefined,
        },
      });

      const nextTitle =
        conversation.title ||
        (params.role === "USER"
          ? conversation.mode === "CREATE"
            ? titleFromCreateMessage(params.content)
            : titleFromContinueStory(
                conversation.story?.title,
                params.content
              )
          : conversation.title);

      const updated = await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          ...(nextTitle && !conversation.title ? { title: nextTitle } : {}),
          ...(params.titleIfEmpty && !conversation.title
            ? { title: params.titleIfEmpty }
            : {}),
        },
        include: {
          story: { select: { id: true, title: true, status: true } },
        },
      });

      return { conversation: updated, message, duplicated: false as const };
    } catch (error) {
      // Unique race on requestId
      if (
        params.requestId &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        const existing = await tx.chatMessage.findFirst({
          where: {
            conversationId: conversation.id,
            requestId: params.requestId,
          },
        });
        if (existing) {
          return {
            conversation,
            message: existing,
            duplicated: true as const,
          };
        }
      }
      throw error;
    }
  });

  return result;
}

export async function updateOwnedConversationState(params: {
  userId: string;
  conversationId: string;
  state: Prisma.InputJsonValue;
  title?: string;
  storyId?: string | null;
  status?: ConversationStatus;
}) {
  await requireOwnedConversation(params.userId, params.conversationId);
  return prisma.conversation.update({
    where: { id: params.conversationId },
    data: {
      state: params.state,
      ...(params.title ? { title: params.title } : {}),
      ...(params.storyId !== undefined ? { storyId: params.storyId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    include: {
      story: { select: { id: true, title: true, status: true } },
    },
  });
}

export async function archiveOwnedConversation(
  userId: string,
  conversationId: string
) {
  await requireOwnedConversation(userId, conversationId);
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "ARCHIVED" },
  });
}

export async function findLatestActiveConversation(params: {
  userId: string;
  mode: ConversationMode;
  storyId?: string | null;
}) {
  return prisma.conversation.findFirst({
    where: {
      userId: params.userId,
      mode: params.mode,
      status: "ACTIVE",
      ...(params.mode === "CONTINUE"
        ? { storyId: params.storyId ?? undefined }
        : { storyId: null }),
    },
    orderBy: { lastMessageAt: "desc" },
  });
}
