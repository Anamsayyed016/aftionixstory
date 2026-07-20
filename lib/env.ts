import { z } from "zod";

/**
 * Server-only environment validation.
 * Import only from server modules (never from client components).
 */

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
});

const liveProviderEnum = z.enum(["gemini", "openai"]);

const aiSchema = z
  .object({
    AI_PROVIDER: z.enum(["gemini", "openai", "mock"]).default("gemini"),
    /** Optional primary override; defaults to AI_PROVIDER when set to openai/gemini. */
    AI_PROVIDER_PRIMARY: z
      .enum(["gemini", "openai", ""])
      .optional()
      .default(""),
    /** Optional fallback; empty = auto (other live provider when key present) or "none". */
    AI_PROVIDER_FALLBACK: z
      .enum(["gemini", "openai", "none", ""])
      .optional()
      .default(""),
    GEMINI_API_KEY: z.string().optional().default(""),
    // Verified against production Gemini listModels + generateContent probe (2026-07).
    GEMINI_STORY_MODEL: z.string().default("gemini-3.1-flash-lite"),
    GEMINI_SUMMARY_MODEL: z.string().default("gemini-3.1-flash-lite"),
    GEMINI_AGENT_MODEL: z.string().default("gemini-3.1-flash-lite"),
    OPENAI_API_KEY: z.string().optional().default(""),
    OPENAI_STORY_MODEL: z.string().default("gpt-5-mini"),
    OPENAI_CREATIVE_MODEL: z.string().optional().default(""),
    OPENAI_SUMMARY_MODEL: z.string().default("gpt-5-nano"),
    OPENAI_AGENT_MODEL: z.string().default("gpt-5-mini"),
    GEMINI_CREATIVE_MODEL: z.string().optional().default(""),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    /** Phase B: optional LLM intent classifier for low-confidence messages */
    AI_INTENT_CLASSIFIER_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("true"),
    AI_INTENT_CONFIDENCE_THRESHOLD: z.coerce
      .number()
      .min(0.3)
      .max(0.95)
      .default(0.55),
    AI_INTENT_CLASSIFIER_MODEL: z.string().optional().default(""),
    AI_INTENT_CLASSIFIER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(4000),
    /** Phase D: Dynamic Context Builder v2 */
    AI_DYNAMIC_CONTEXT_V2_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("true"),
    /** Phase E: Prompt Registry v2 */
    AI_PROMPT_REGISTRY_V2_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("true"),
    /** Phase F: Provider Router v2 */
    AI_PROVIDER_ROUTER_V2_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("true"),
    AI_PROVIDER_CIRCUIT_BREAKER_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("true"),
    /** Phase G: Story Tool Framework (deterministic tools; AI plans only) */
    AI_STORY_TOOL_FRAMEWORK_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("false"),
    /** Phase G.5: Instruction Fidelity + output validation */
    AI_INSTRUCTION_FIDELITY_V1_ENABLED: z
      .enum(["true", "false", "1", "0", "yes", "no", ""])
      .optional()
      .default("false"),
  })
  .superRefine((data, ctx) => {
    if (process.env.NODE_ENV === "production" && data.AI_PROVIDER === "mock") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AI_PROVIDER"],
        message:
          "AI_PROVIDER=mock is not allowed in production. Use openai or gemini.",
      });
    }
    void liveProviderEnum;
  });

export type AiProviderLive = z.infer<typeof liveProviderEnum>;

export type ServerEnv = z.infer<typeof baseSchema>;
export type AiEnv = z.infer<typeof aiSchema>;

let cachedBase: ServerEnv | null = null;
let cachedAi: AiEnv | null = null;

function readRawBaseEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID:
      process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "",
    GOOGLE_CLIENT_SECRET:
      process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "",
  };
}

function readRawAiEnv() {
  const rawProvider = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (rawProvider === "local") {
    throw new Error(
      "Invalid AI environment configuration: AI_PROVIDER=local is not supported yet. Use openai or gemini."
    );
  }
  return {
    AI_PROVIDER: rawProvider,
    AI_PROVIDER_PRIMARY: (process.env.AI_PROVIDER_PRIMARY || "")
      .trim()
      .toLowerCase(),
    AI_PROVIDER_FALLBACK: (process.env.AI_PROVIDER_FALLBACK || "")
      .trim()
      .toLowerCase(),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_STORY_MODEL:
      process.env.GEMINI_STORY_MODEL || "gemini-3.1-flash-lite",
    GEMINI_CREATIVE_MODEL:
      process.env.GEMINI_CREATIVE_MODEL ||
      process.env.GEMINI_STORY_MODEL ||
      "gemini-3.1-flash-lite",
    GEMINI_SUMMARY_MODEL:
      process.env.GEMINI_SUMMARY_MODEL ||
      process.env.GEMINI_STORY_MODEL ||
      "gemini-3.1-flash-lite",
    GEMINI_AGENT_MODEL:
      process.env.GEMINI_AGENT_MODEL ||
      process.env.GEMINI_STORY_MODEL ||
      "gemini-3.1-flash-lite",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    OPENAI_STORY_MODEL: process.env.OPENAI_STORY_MODEL || "gpt-5-mini",
    OPENAI_CREATIVE_MODEL:
      process.env.OPENAI_CREATIVE_MODEL ||
      process.env.OPENAI_STORY_MODEL ||
      "gpt-5-mini",
    OPENAI_SUMMARY_MODEL:
      process.env.OPENAI_SUMMARY_MODEL ||
      process.env.OPENAI_STORY_MODEL ||
      "gpt-5-nano",
    OPENAI_AGENT_MODEL:
      process.env.OPENAI_AGENT_MODEL ||
      process.env.OPENAI_STORY_MODEL ||
      "gpt-5-mini",
    AI_REQUEST_TIMEOUT_MS: process.env.AI_REQUEST_TIMEOUT_MS || "60000",
    AI_MAX_RETRIES: process.env.AI_MAX_RETRIES || "2",
    AI_RATE_LIMIT_WINDOW_MS: process.env.AI_RATE_LIMIT_WINDOW_MS || "60000",
    AI_RATE_LIMIT_MAX: process.env.AI_RATE_LIMIT_MAX || "10",
    AI_INTENT_CLASSIFIER_ENABLED:
      process.env.AI_INTENT_CLASSIFIER_ENABLED || "true",
    AI_INTENT_CONFIDENCE_THRESHOLD:
      process.env.AI_INTENT_CONFIDENCE_THRESHOLD || "0.55",
    AI_INTENT_CLASSIFIER_MODEL: process.env.AI_INTENT_CLASSIFIER_MODEL || "",
    AI_INTENT_CLASSIFIER_TIMEOUT_MS:
      process.env.AI_INTENT_CLASSIFIER_TIMEOUT_MS || "4000",
    AI_DYNAMIC_CONTEXT_V2_ENABLED:
      process.env.AI_DYNAMIC_CONTEXT_V2_ENABLED || "true",
    AI_PROMPT_REGISTRY_V2_ENABLED:
      process.env.AI_PROMPT_REGISTRY_V2_ENABLED || "true",
    AI_PROVIDER_ROUTER_V2_ENABLED:
      process.env.AI_PROVIDER_ROUTER_V2_ENABLED || "true",
    AI_PROVIDER_CIRCUIT_BREAKER_ENABLED:
      process.env.AI_PROVIDER_CIRCUIT_BREAKER_ENABLED || "true",
    AI_STORY_TOOL_FRAMEWORK_ENABLED:
      process.env.AI_STORY_TOOL_FRAMEWORK_ENABLED || "false",
    AI_INSTRUCTION_FIDELITY_V1_ENABLED:
      process.env.AI_INSTRUCTION_FIDELITY_V1_ENABLED || "false",
  };
}

/**
 * Parse and cache validated env. Throws on invalid configuration.
 * Call from server code at request time — not at module top-level in
 * modules that may be evaluated during `next build` without secrets.
 */
export function getEnv(): ServerEnv {
  if (cachedBase) return cachedBase;
  const parsed = baseSchema.safeParse(readRawBaseEnv());
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  cachedBase = parsed.data;
  return cachedBase;
}

export function getAiEnv(): AiEnv {
  if (cachedAi) return cachedAi;
  const parsed = aiSchema.safeParse(readRawAiEnv());
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid AI environment configuration: ${details}`);
  }
  cachedAi = parsed.data;
  return cachedAi;
}

/** Active story model for the configured AI_PROVIDER. */
export function resolveStoryModel(env: AiEnv = getAiEnv()): string {
  if (env.AI_PROVIDER === "openai") return env.OPENAI_STORY_MODEL;
  return env.GEMINI_STORY_MODEL;
}

/**
 * Creative prose model (scenes/episodes). Prefers *_CREATIVE_MODEL, else story model.
 */
export function resolveCreativeModel(env: AiEnv = getAiEnv()): string {
  if (env.AI_PROVIDER === "openai") {
    return env.OPENAI_CREATIVE_MODEL?.trim() || env.OPENAI_STORY_MODEL;
  }
  return env.GEMINI_CREATIVE_MODEL?.trim() || env.GEMINI_STORY_MODEL;
}

/** Fast conversational / intent model. */
export function resolveAgentModel(env: AiEnv = getAiEnv()): string {
  if (env.AI_PROVIDER === "openai") return env.OPENAI_AGENT_MODEL;
  return env.GEMINI_AGENT_MODEL;
}

/** Active summary model for the configured AI_PROVIDER. */
export function resolveSummaryModel(env: AiEnv = getAiEnv()): string {
  if (env.AI_PROVIDER === "openai") return env.OPENAI_SUMMARY_MODEL;
  return env.GEMINI_SUMMARY_MODEL;
}

/** Whether the active provider's API key is present (never returns the key). */
export function isActiveAiKeyPresent(env: AiEnv = getAiEnv()): boolean {
  if (env.AI_PROVIDER === "openai") return Boolean(env.OPENAI_API_KEY.trim());
  if (env.AI_PROVIDER === "gemini") return Boolean(env.GEMINI_API_KEY.trim());
  return true; // mock
}

export function isProviderKeyPresent(
  provider: AiProviderLive,
  env: AiEnv = getAiEnv()
): boolean {
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY.trim());
  return Boolean(env.GEMINI_API_KEY.trim());
}

export function resolveAgentModelForProvider(
  provider: AiProviderLive,
  env: AiEnv = getAiEnv()
): string {
  return provider === "openai" ? env.OPENAI_AGENT_MODEL : env.GEMINI_AGENT_MODEL;
}

export function resolveCreativeModelForProvider(
  provider: AiProviderLive,
  env: AiEnv = getAiEnv()
): string {
  if (provider === "openai") {
    return env.OPENAI_CREATIVE_MODEL?.trim() || env.OPENAI_STORY_MODEL;
  }
  return env.GEMINI_CREATIVE_MODEL?.trim() || env.GEMINI_STORY_MODEL;
}

export function resolveStoryModelForProvider(
  provider: AiProviderLive,
  env: AiEnv = getAiEnv()
): string {
  return provider === "openai" ? env.OPENAI_STORY_MODEL : env.GEMINI_STORY_MODEL;
}

/**
 * Resolve primary + optional sequential fallback.
 * AI_PROVIDER_PRIMARY overrides AI_PROVIDER when set to openai/gemini.
 * AI_PROVIDER_FALLBACK=none disables fallback; empty auto-picks the other live provider when keyed.
 */
export function resolveFailoverProviders(env: AiEnv = getAiEnv()): {
  primary: AiProviderLive;
  fallback: AiProviderLive | null;
} {
  const primaryRaw =
    env.AI_PROVIDER_PRIMARY === "openai" || env.AI_PROVIDER_PRIMARY === "gemini"
      ? env.AI_PROVIDER_PRIMARY
      : env.AI_PROVIDER === "openai" || env.AI_PROVIDER === "gemini"
        ? env.AI_PROVIDER
        : "gemini";

  const primary = primaryRaw as AiProviderLive;
  const other: AiProviderLive = primary === "openai" ? "gemini" : "openai";

  let fallback: AiProviderLive | null = null;
  if (env.AI_PROVIDER_FALLBACK === "none") {
    fallback = null;
  } else if (
    env.AI_PROVIDER_FALLBACK === "openai" ||
    env.AI_PROVIDER_FALLBACK === "gemini"
  ) {
    fallback =
      env.AI_PROVIDER_FALLBACK === primary ? null : env.AI_PROVIDER_FALLBACK;
  } else if (isProviderKeyPresent(other, env)) {
    fallback = other;
  }

  return { primary, fallback };
}

/** Require provider key when using a live AI provider. */
export function assertAiProviderConfigured(): AiEnv {
  const env = getAiEnv();
  if (env.AI_PROVIDER === "gemini" && !env.GEMINI_API_KEY.trim()) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY.trim()) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  return env;
}

/** @deprecated Prefer assertAiProviderConfigured */
export function assertGeminiConfigured(): AiEnv {
  return assertAiProviderConfigured();
}

export function isGoogleOAuthConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const secret =
    process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  return Boolean(id && secret);
}

/** Test helper — clear caches between Vitest cases. */
export function __resetEnvCacheForTests() {
  cachedBase = null;
  cachedAi = null;
}
