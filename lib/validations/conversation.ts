import { z } from "zod";

export const conversationModeSchema = z.enum(["CREATE", "CONTINUE"]);
export const conversationStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const chatMessageRoleSchema = z.enum(["USER", "ASSISTANT"]);
export const chatMessageStatusSchema = z.enum(["SENT", "ERROR"]);

export const createConversationSchema = z
  .object({
    mode: conversationModeSchema,
    storyId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "CONTINUE" && !data.storyId) {
      ctx.addIssue({
        code: "custom",
        path: ["storyId"],
        message: "Continue conversations require a story.",
      });
    }
    if (data.mode === "CREATE" && data.storyId) {
      ctx.addIssue({
        code: "custom",
        path: ["storyId"],
        message: "Create conversations start without a storyId.",
      });
    }
  });

export const conversationIdSchema = z.object({
  conversationId: z.string().min(1),
});

export const listConversationsSchema = z.object({
  mode: conversationModeSchema,
  storyId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const appendChatMessageSchema = z.object({
  conversationId: z.string().min(1),
  role: chatMessageRoleSchema,
  content: z.string().trim().min(1).max(10000),
  status: chatMessageStatusSchema.optional().default("SENT"),
  requestId: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const continueDraftStateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(100_000),
    wordCount: z.number().int().min(0),
    episodeNumber: z.number().int().min(0).optional(),
    clientRequestId: z.string().min(8).max(80),
    action: z.string().optional(),
    replaceEpisodeId: z.string().optional(),
    userInstruction: z.string().optional(),
  })
  .optional()
  .nullable();

export const createConversationStateSchema = z.object({
  extraction: z.unknown().optional(),
  extractionStatus: z.enum(["needs_more_info", "complete"]).optional(),
  missing: z.array(z.string()).optional(),
  draftForm: z.unknown().optional(),
  storyId: z.string().optional(),
  // Conversational Story Agent memory (additive)
  storyMemory: z.unknown().optional(),
  characters: z.unknown().optional(),
  relationships: z.unknown().optional(),
  writingRules: z.unknown().optional(),
  userPreferences: z.unknown().optional(),
  latestDraft: z.unknown().optional(),
  updatedAt: z.string().optional(),
  agentVersion: z.string().optional(),
});

export const continueConversationStateSchema = z.object({
  instruction: z.string().max(5000).optional(),
  draft: continueDraftStateSchema,
  draftDirty: z.boolean().optional(),
  draftSavedEpisodeId: z.string().optional(),
});

export const updateConversationStateSchema = z.object({
  conversationId: z.string().min(1),
  state: z.union([createConversationStateSchema, continueConversationStateSchema]),
  title: z.string().trim().min(1).max(120).optional(),
  storyId: z.string().min(1).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AppendChatMessageInput = z.infer<typeof appendChatMessageSchema>;
export type CreateConversationState = z.infer<typeof createConversationStateSchema>;
export type ContinueConversationState = z.infer<
  typeof continueConversationStateSchema
>;
