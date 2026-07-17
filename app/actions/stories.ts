"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  AuthzError,
  authzToActionError,
  requireAuthenticatedUser,
  requireStoryOwnership,
} from "@/lib/auth/authorization";
import { allocateUniqueSlug } from "@/lib/data/slugs";
import { getPlanLimits } from "@/lib/plans";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  createStoryWizardSchema,
  saveDraftStorySchema,
  updateStorySchema,
  type CharacterInput,
  type RelationshipInput,
  type WritingRuleInput,
} from "@/lib/validations/story";

function uniqueCharacterNames(characters: CharacterInput[]) {
  const seen = new Set<string>();
  for (const c of characters) {
    const key = c.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

async function createStoryGraph(params: {
  userId: string;
  status: "DRAFT" | "ACTIVE";
  data: {
    title: string;
    description?: string;
    genre: string;
    language: string;
    storyType?: string;
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    writingStyle?: string;
    dialogueStyle?: string;
    pointOfView?: string;
    episodeLength?: string;
    tone?: string;
    romanceLevel?: string;
    pacing?: string;
    customInstructions?: string;
    setting?: string;
    timePeriod?: string;
    mainConflict?: string;
    initialPlot?: string;
    worldRules?: string;
    contentBoundaries?: string;
    currentSummary?: string;
  };
  characters: CharacterInput[];
  relationships: RelationshipInput[];
  writingRules: WritingRuleInput[];
}) {
  const slug = await allocateUniqueSlug(params.userId, params.data.title);

  return prisma.$transaction(async (tx) => {
    const story = await tx.story.create({
      data: {
        userId: params.userId,
        slug,
        status: params.status,
        title: params.data.title,
        description: params.data.description,
        genre: params.data.genre,
        language: params.data.language,
        storyType: params.data.storyType,
        visibility: params.data.visibility,
        writingStyle: params.data.writingStyle,
        dialogueStyle: params.data.dialogueStyle,
        pointOfView: params.data.pointOfView,
        episodeLength: params.data.episodeLength,
        tone: params.data.tone,
        romanceLevel: params.data.romanceLevel,
        pacing: params.data.pacing,
        customInstructions: params.data.customInstructions,
        setting: params.data.setting,
        timePeriod: params.data.timePeriod,
        mainConflict: params.data.mainConflict,
        initialPlot: params.data.initialPlot,
        worldRules: params.data.worldRules,
        contentBoundaries: params.data.contentBoundaries,
        currentSummary: params.data.currentSummary,
      },
    });

    const idMap = new Map<string, string>();

    for (let i = 0; i < params.characters.length; i++) {
      const c = params.characters[i];
      const created = await tx.character.create({
        data: {
          storyId: story.id,
          name: c.name,
          age: c.age ?? null,
          gender: c.gender,
          role: c.role,
          appearance: c.appearance,
          personality: c.personality,
          background: c.background,
          speakingStyle: c.speakingStyle,
          secrets: c.secrets,
          emotionalState: c.emotionalState,
          sortOrder: c.sortOrder ?? i,
          status: "ACTIVE",
        },
      });
      if (c.clientId) idMap.set(c.clientId, created.id);
    }

    for (const rel of params.relationships) {
      const sourceId = idMap.get(rel.sourceClientId);
      const targetId = idMap.get(rel.targetClientId);
      if (!sourceId || !targetId) {
        throw new Error("RELATIONSHIP_MAP_ERROR");
      }
      await tx.characterRelationship.create({
        data: {
          storyId: story.id,
          sourceCharacterId: sourceId,
          targetCharacterId: targetId,
          relationshipType: rel.relationshipType,
          description: rel.description,
          currentStatus: rel.currentStatus,
          emotionalDynamic: rel.emotionalDynamic,
        },
      });
    }

    for (const rule of params.writingRules) {
      await tx.writingRule.create({
        data: {
          storyId: story.id,
          rule: rule.rule,
          category: rule.category,
          priority: rule.priority ?? 5,
          isActive: rule.isActive ?? true,
        },
      });
    }

    return story;
  });
}

export async function createStoryAction(
  input: unknown
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = createStoryWizardSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    if (!uniqueCharacterNames(parsed.data.characters)) {
      return fail("DUPLICATE_CHARACTER", "Character names must be unique within a story.");
    }

    const limits = getPlanLimits(user.plan);
    const storyCount = await prisma.story.count({ where: { userId: user.id } });
    if (storyCount >= limits.maxStories) {
      return fail(
        "STORY_LIMIT_REACHED",
        `Your ${limits.label} plan allows up to ${limits.maxStories} stories.`
      );
    }

    if (parsed.data.characters.length > limits.maxActiveCharactersPerStory) {
      return fail(
        "CHARACTER_LIMIT_REACHED",
        `Your plan allows up to ${limits.maxActiveCharactersPerStory} characters per story.`
      );
    }

    const { characters, relationships, writingRules, status, ...storyFields } =
      parsed.data;

    const story = await createStoryGraph({
      userId: user.id,
      status: status === "DRAFT" ? "DRAFT" : "ACTIVE",
      data: storyFields,
      characters,
      relationships,
      writingRules,
    });

    revalidatePath("/stories");
    revalidatePath("/dashboard");
    return ok({ storyId: story.id });
  } catch (error) {
    if (error instanceof Error && error.message === "RELATIONSHIP_MAP_ERROR") {
      return fail(
        "VALIDATION_ERROR",
        "Relationships must reference characters from this story."
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("CONFLICT", "A story with a similar title already exists. Try another title.");
    }
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function saveDraftStoryAction(
  input: unknown
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = saveDraftStorySchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    if (parsed.data.characters.length && !uniqueCharacterNames(parsed.data.characters)) {
      return fail("DUPLICATE_CHARACTER", "Character names must be unique within a story.");
    }

    const limits = getPlanLimits(user.plan);
    const storyCount = await prisma.story.count({ where: { userId: user.id } });
    if (storyCount >= limits.maxStories) {
      return fail(
        "STORY_LIMIT_REACHED",
        `Your ${limits.label} plan allows up to ${limits.maxStories} stories.`
      );
    }

    const { characters, relationships, writingRules, ...storyFields } = parsed.data;

    const story = await createStoryGraph({
      userId: user.id,
      status: "DRAFT",
      data: {
        ...storyFields,
        genre: storyFields.genre || "Custom",
        language: storyFields.language || "English",
        visibility: storyFields.visibility || "PRIVATE",
      },
      characters,
      relationships,
      writingRules,
    });

    revalidatePath("/stories");
    revalidatePath("/dashboard");
    return ok({ storyId: story.id }, "Draft saved.");
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function updateStoryAction(
  storyId: string,
  input: unknown
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const { user, story } = await requireStoryOwnership(storyId);
    const parsed = updateStorySchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const data = { ...parsed.data };
    let slug = story.slug;
    if (data.title && data.title !== story.title) {
      slug = await allocateUniqueSlug(user.id, data.title, story.id);
    }

    await prisma.story.update({
      where: { id: story.id },
      data: { ...data, slug },
    });

    revalidatePath("/stories");
    revalidatePath(`/stories/${story.id}`);
    revalidatePath("/dashboard");
    return ok({ storyId: story.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function replaceStoryGraphAction(
  storyId: string,
  input: unknown
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const { user, story } = await requireStoryOwnership(storyId);
    const parsed = createStoryWizardSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    if (!uniqueCharacterNames(parsed.data.characters)) {
      return fail("DUPLICATE_CHARACTER", "Character names must be unique within a story.");
    }

    const limits = getPlanLimits(user.plan);
    if (parsed.data.characters.length > limits.maxActiveCharactersPerStory) {
      return fail(
        "CHARACTER_LIMIT_REACHED",
        `Your plan allows up to ${limits.maxActiveCharactersPerStory} characters per story.`
      );
    }

    const { characters, relationships, writingRules, status, ...storyFields } =
      parsed.data;

    const slug =
      storyFields.title !== story.title
        ? await allocateUniqueSlug(user.id, storyFields.title, story.id)
        : story.slug;

    await prisma.$transaction(async (tx) => {
      await tx.characterRelationship.deleteMany({ where: { storyId: story.id } });
      await tx.writingRule.deleteMany({ where: { storyId: story.id } });
      await tx.character.deleteMany({ where: { storyId: story.id } });

      await tx.story.update({
        where: { id: story.id },
        data: {
          ...storyFields,
          slug,
          status: status === "DRAFT" ? "DRAFT" : story.status === "ARCHIVED" ? "ARCHIVED" : status,
        },
      });

      const idMap = new Map<string, string>();
      for (let i = 0; i < characters.length; i++) {
        const c = characters[i];
        const created = await tx.character.create({
          data: {
            storyId: story.id,
            name: c.name,
            age: c.age ?? null,
            gender: c.gender,
            role: c.role,
            appearance: c.appearance,
            personality: c.personality,
            background: c.background,
            speakingStyle: c.speakingStyle,
            secrets: c.secrets,
            emotionalState: c.emotionalState,
            sortOrder: c.sortOrder ?? i,
          },
        });
        if (c.clientId) idMap.set(c.clientId, created.id);
      }

      for (const rel of relationships) {
        const sourceId = idMap.get(rel.sourceClientId);
        const targetId = idMap.get(rel.targetClientId);
        if (!sourceId || !targetId) throw new Error("RELATIONSHIP_MAP_ERROR");
        await tx.characterRelationship.create({
          data: {
            storyId: story.id,
            sourceCharacterId: sourceId,
            targetCharacterId: targetId,
            relationshipType: rel.relationshipType,
            description: rel.description,
            currentStatus: rel.currentStatus,
            emotionalDynamic: rel.emotionalDynamic,
          },
        });
      }

      for (const rule of writingRules) {
        await tx.writingRule.create({
          data: {
            storyId: story.id,
            rule: rule.rule,
            category: rule.category,
            priority: rule.priority ?? 5,
            isActive: rule.isActive ?? true,
          },
        });
      }
    });

    revalidatePath("/stories");
    revalidatePath(`/stories/${story.id}`);
    revalidatePath(`/stories/${story.id}/edit`);
    revalidatePath(`/stories/${story.id}/characters`);
    revalidatePath("/dashboard");
    return ok({ storyId: story.id });
  } catch (error) {
    if (error instanceof Error && error.message === "RELATIONSHIP_MAP_ERROR") {
      return fail(
        "VALIDATION_ERROR",
        "Relationships must reference characters from this story."
      );
    }
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function archiveStoryAction(
  storyId: string
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const { story } = await requireStoryOwnership(storyId);
    await prisma.story.update({
      where: { id: story.id },
      data: { status: "ARCHIVED" },
    });
    revalidatePath("/stories");
    revalidatePath(`/stories/${story.id}`);
    revalidatePath("/dashboard");
    return ok({ storyId: story.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function deleteStoryAction(
  storyId: string
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const { story } = await requireStoryOwnership(storyId);
    await prisma.story.delete({ where: { id: story.id } });
    revalidatePath("/stories");
    revalidatePath("/dashboard");
    return ok({ storyId: story.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function duplicateStoryAction(
  storyId: string
): Promise<ActionResult<{ storyId: string }>> {
  try {
    const { user, story } = await requireStoryOwnership(storyId);
    const limits = getPlanLimits(user.plan);
    const storyCount = await prisma.story.count({ where: { userId: user.id } });
    if (storyCount >= limits.maxStories) {
      return fail(
        "STORY_LIMIT_REACHED",
        `Your ${limits.label} plan allows up to ${limits.maxStories} stories.`
      );
    }

    const full = await prisma.story.findFirst({
      where: { id: story.id, userId: user.id },
      include: {
        characters: true,
        relationships: true,
        writingRules: true,
      },
    });
    if (!full) throw new AuthzError("NOT_FOUND", "Story not found.");

    const title = `${full.title} (Copy)`;
    const slug = await allocateUniqueSlug(user.id, title);

    const created = await prisma.$transaction(async (tx) => {
      const copy = await tx.story.create({
        data: {
          userId: user.id,
          title,
          slug,
          description: full.description,
          genre: full.genre,
          language: full.language,
          storyType: full.storyType,
          visibility: full.visibility,
          writingStyle: full.writingStyle,
          dialogueStyle: full.dialogueStyle,
          pointOfView: full.pointOfView,
          episodeLength: full.episodeLength,
          tone: full.tone,
          romanceLevel: full.romanceLevel,
          pacing: full.pacing,
          customInstructions: full.customInstructions,
          setting: full.setting,
          timePeriod: full.timePeriod,
          mainConflict: full.mainConflict,
          initialPlot: full.initialPlot,
          worldRules: full.worldRules,
          contentBoundaries: full.contentBoundaries,
          currentSummary: full.currentSummary,
          status: "DRAFT",
          totalEpisodes: 0,
        },
      });

      const idMap = new Map<string, string>();
      for (const c of full.characters) {
        const nc = await tx.character.create({
          data: {
            storyId: copy.id,
            name: c.name,
            age: c.age,
            gender: c.gender,
            role: c.role,
            appearance: c.appearance,
            personality: c.personality,
            background: c.background,
            speakingStyle: c.speakingStyle,
            secrets: c.secrets,
            emotionalState: c.emotionalState,
            status: c.status,
            sortOrder: c.sortOrder,
          },
        });
        idMap.set(c.id, nc.id);
      }

      for (const rel of full.relationships) {
        const sourceId = idMap.get(rel.sourceCharacterId);
        const targetId = idMap.get(rel.targetCharacterId);
        if (!sourceId || !targetId) continue;
        await tx.characterRelationship.create({
          data: {
            storyId: copy.id,
            sourceCharacterId: sourceId,
            targetCharacterId: targetId,
            relationshipType: rel.relationshipType,
            description: rel.description,
            currentStatus: rel.currentStatus,
            emotionalDynamic: rel.emotionalDynamic,
          },
        });
      }

      for (const rule of full.writingRules) {
        await tx.writingRule.create({
          data: {
            storyId: copy.id,
            rule: rule.rule,
            category: rule.category,
            priority: rule.priority,
            isActive: rule.isActive,
          },
        });
      }

      return copy;
    });

    revalidatePath("/stories");
    revalidatePath("/dashboard");
    return ok({ storyId: created.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}
