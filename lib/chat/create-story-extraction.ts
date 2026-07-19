import { z } from "zod";

import {
  createStoryWizardSchema,
  type CreateStoryWizardInput,
} from "@/lib/validations/story";

const optionalString = z.preprocess(
  (v) => {
    if (v == null) return undefined;
    const t = String(v).trim();
    return t.length > 0 ? t : undefined;
  },
  z.string().optional()
);

const extractedCharacterSchema = z.object({
  clientId: optionalString,
  id: optionalString,
  name: z.string().trim().min(1).max(100),
  age: z.union([z.number(), z.string(), z.null()]).optional(),
  gender: optionalString,
  role: optionalString,
  appearance: optionalString,
  personality: optionalString,
  background: optionalString,
  speakingStyle: optionalString,
  secrets: optionalString,
  emotionalState: optionalString,
  sortOrder: z.union([z.number(), z.string()]).optional(),
});

const extractedRelationshipSchema = z.object({
  sourceClientId: optionalString,
  targetClientId: optionalString,
  sourceId: optionalString,
  targetId: optionalString,
  sourceName: optionalString,
  targetName: optionalString,
  relationshipType: z.string().trim().min(1).max(100),
  description: optionalString,
  currentStatus: optionalString,
  emotionalDynamic: optionalString,
});

const extractedRuleSchema = z.object({
  rule: z.string().trim().min(2).max(1000),
  category: optionalString,
  priority: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
});

export const chatStoryDraftSchema = z.object({
  title: optionalString,
  description: optionalString,
  synopsis: optionalString,
  genre: optionalString,
  language: optionalString,
  tone: optionalString,
  setting: optionalString,
  targetAudience: optionalString,
  storyType: optionalString,
  pov: optionalString,
  pointOfView: optionalString,
  writingStyle: optionalString,
  pacing: optionalString,
  themes: z
    .union([z.array(z.string()), z.string(), z.null(), z.undefined()])
    .optional(),
  plot: optionalString,
  initialPlot: optionalString,
  mainConflict: optionalString,
  timePeriod: optionalString,
  worldRules: optionalString,
  contentBoundaries: optionalString,
  dialogueStyle: optionalString,
  episodeLength: optionalString,
  romanceLevel: optionalString,
  customInstructions: optionalString,
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  characters: z.array(extractedCharacterSchema).optional().default([]),
  relationships: z.array(extractedRelationshipSchema).optional().default([]),
  writingRules: z.array(extractedRuleSchema).optional().default([]),
});

export const chatCreateExtractionSchema = z.object({
  status: z.enum(["complete", "needs_more_info"]),
  missing: z.array(z.string()).optional().default([]),
  assistantReply: z.string().trim().min(1),
  story: chatStoryDraftSchema.optional(),
});

export type ChatCreateExtraction = z.infer<typeof chatCreateExtractionSchema>;
export type ChatStoryDraft = z.infer<typeof chatStoryDraftSchema>;

export type NormalizedChatStoryDraft = Partial<CreateStoryWizardInput> & {
  characters: CreateStoryWizardInput["characters"];
  relationships: CreateStoryWizardInput["relationships"];
  writingRules: CreateStoryWizardInput["writingRules"];
};

function themesToText(
  themes: ChatStoryDraft["themes"]
): string | undefined {
  if (themes == null) return undefined;
  if (Array.isArray(themes)) {
    const joined = themes.map((t) => t.trim()).filter(Boolean).join(", ");
    return joined || undefined;
  }
  const t = String(themes).trim();
  return t || undefined;
}

function coerceAge(
  age: string | number | null | undefined
): number | null | undefined {
  if (age == null || age === "") return undefined;
  const n = typeof age === "number" ? age : Number(age);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function findClientIdByName(
  characters: Array<{ clientId: string; name: string }>,
  name: string | undefined
): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return characters.find((c) => c.name.trim().toLowerCase() === key)?.clientId;
}

/** Map Gemini story payload into StoryWizard-compatible shape. */
export function normalizeChatStoryDraft(
  draft?: Record<string, unknown> | Partial<ChatStoryDraft> | ChatStoryDraft | null
): NormalizedChatStoryDraft {
  const parsed = chatStoryDraftSchema.safeParse(draft ?? {});
  const source: Partial<ChatStoryDraft> = parsed.success
    ? parsed.data
    : ((draft ?? {}) as Partial<ChatStoryDraft>);

  const characters = (source.characters ?? []).map((c, index) => {
    const clientId = c.clientId || c.id || `c${index + 1}`;
    return {
      clientId,
      name: c.name,
      age: coerceAge(c.age) ?? null,
      gender: c.gender,
      role: c.role?.trim() || "",
      appearance: c.appearance,
      personality: c.personality?.trim() || "",
      background: c.background,
      speakingStyle: c.speakingStyle,
      secrets: c.secrets,
      emotionalState: c.emotionalState,
      sortOrder:
        c.sortOrder != null && Number.isFinite(Number(c.sortOrder))
          ? Number(c.sortOrder)
          : index,
    };
  });

  const relationships = (source.relationships ?? [])
    .map((r) => {
      const sourceClientId =
        r.sourceClientId ||
        r.sourceId ||
        findClientIdByName(characters, r.sourceName);
      const targetClientId =
        r.targetClientId ||
        r.targetId ||
        findClientIdByName(characters, r.targetName);
      if (!sourceClientId || !targetClientId) return null;
      if (sourceClientId === targetClientId) return null;
      return {
        sourceClientId,
        targetClientId,
        relationshipType: r.relationshipType,
        description: r.description,
        currentStatus: r.currentStatus,
        emotionalDynamic: r.emotionalDynamic,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const writingRules = (source.writingRules ?? []).map((rule) => ({
    rule: rule.rule,
    category: rule.category,
    priority:
      rule.priority != null && Number.isFinite(Number(rule.priority))
        ? Math.min(10, Math.max(1, Number(rule.priority)))
        : 5,
    isActive: rule.isActive ?? true,
  }));

  const themes = themesToText(source.themes);
  const customInstructions = [source.customInstructions, themes]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    title: source.title,
    description: source.description || source.synopsis,
    genre: source.genre,
    language: source.language,
    storyType: source.storyType || source.targetAudience,
    visibility: source.visibility ?? "PRIVATE",
    writingStyle: source.writingStyle,
    dialogueStyle: source.dialogueStyle,
    pointOfView: source.pointOfView || source.pov,
    episodeLength: source.episodeLength,
    tone: source.tone,
    romanceLevel: source.romanceLevel,
    pacing: source.pacing,
    customInstructions: customInstructions || undefined,
    setting: source.setting,
    timePeriod: source.timePeriod,
    mainConflict: source.mainConflict,
    initialPlot: source.initialPlot || source.plot,
    worldRules: source.worldRules,
    contentBoundaries: source.contentBoundaries,
    status: "ACTIVE",
    characters,
    relationships,
    writingRules,
  };
}

const REQUIRED_HINTS: Array<{ key: string; test: (d: NormalizedChatStoryDraft) => boolean }> =
  [
    { key: "title", test: (d) => Boolean(d.title && d.title.trim().length >= 3) },
    { key: "genre", test: (d) => Boolean(d.genre && d.genre.trim().length >= 2) },
    {
      key: "language",
      test: (d) => Boolean(d.language && d.language.trim().length >= 2),
    },
    {
      key: "characters",
      test: (d) =>
        d.characters.length >= 1 &&
        d.characters.every(
          (c) =>
            c.name.trim().length > 0 &&
            c.role.trim().length > 0 &&
            c.personality.trim().length >= 3
        ),
    },
  ];

export function computeMissingStoryFields(
  draft: NormalizedChatStoryDraft
): string[] {
  const missing = REQUIRED_HINTS.filter((h) => !h.test(draft)).map((h) => h.key);

  const parsed = createStoryWizardSchema.safeParse({
    ...draft,
    title: draft.title ?? "",
    genre: draft.genre ?? "",
    language: draft.language ?? "",
    visibility: draft.visibility ?? "PRIVATE",
    status: draft.status ?? "ACTIVE",
    characters: draft.characters,
    relationships: draft.relationships,
    writingRules: draft.writingRules,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "story";
      if (!missing.includes(path)) missing.push(path);
    }
  }

  return missing;
}

export function evaluateStoryCompleteness(draft: NormalizedChatStoryDraft): {
  status: "complete" | "needs_more_info";
  missing: string[];
  wizardInput: CreateStoryWizardInput | null;
} {
  const missing = computeMissingStoryFields(draft);
  const parsed = createStoryWizardSchema.safeParse({
    ...draft,
    title: draft.title ?? "",
    genre: draft.genre ?? "",
    language: draft.language ?? "",
    visibility: draft.visibility ?? "PRIVATE",
    status: "ACTIVE",
    characters: draft.characters,
    relationships: draft.relationships,
    writingRules: draft.writingRules,
  });

  if (parsed.success && missing.length === 0) {
    return { status: "complete", missing: [], wizardInput: parsed.data };
  }

  return {
    status: "needs_more_info",
    missing: missing.length > 0 ? missing : ["title", "genre", "language", "characters"],
    wizardInput: null,
  };
}

/** Strip fences and parse the first JSON object from model output. */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("INVALID_JSON");
  }
}

export function parseChatCreateExtraction(raw: string): ChatCreateExtraction {
  const json = extractJsonObject(raw);
  const parsed = chatCreateExtractionSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("INVALID_EXTRACTION");
  }
  return parsed.data;
}
