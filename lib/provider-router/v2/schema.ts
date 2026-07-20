/**
 * Zod schemas for GenerationRequest / GenerationResult (Phase F).
 */

import { z } from "zod";

export const providerHintsSchema = z.object({
  temperatureProfile: z.enum(["deterministic", "balanced", "creative"]),
  maxOutputTokensProfile: z.enum([
    "short",
    "medium",
    "long",
    "long_creative",
  ]),
  reasoningProfile: z.enum(["none", "low"]),
  jsonMode: z.boolean(),
});

export const promptMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const generationRequestSchema = z.object({
  requestId: z.string().min(1),
  turnRequestId: z.string().optional(),
  conversationId: z.string().optional(),
  operation: z.string().min(1),
  intent: z.string().optional(),
  prompt: z.object({
    promptId: z.string(),
    promptVersion: z.string(),
    messages: z.array(promptMessageSchema).min(1),
    outputMode: z.enum(["text", "json"]),
    providerHints: providerHintsSchema,
  }),
  routing: z
    .object({
      preferredProvider: z
        .enum(["openai", "gemini", "mock"])
        .nullable()
        .optional(),
      allowedProviders: z.array(z.enum(["openai", "gemini", "mock"])).optional(),
      fallbackAllowed: z.boolean().optional(),
      retryAllowed: z.boolean().optional(),
    })
    .optional(),
  constraints: z
    .object({
      timeoutMs: z.number().int().positive().optional(),
      maxAttemptsPerProvider: z.number().int().min(1).max(5).optional(),
      maxTotalAttempts: z.number().int().min(1).max(8).optional(),
      totalDeadlineMs: z.number().int().positive().optional(),
    })
    .optional(),
  metadata: z
    .object({
      storyId: z.string().nullable().optional(),
      episodeId: z.string().nullable().optional(),
      classifier: z.boolean().optional(),
      modelKind: z.enum(["agent", "creative", "story"]).optional(),
    })
    .optional(),
});

export type GenerationRequestParsed = z.infer<typeof generationRequestSchema>;
