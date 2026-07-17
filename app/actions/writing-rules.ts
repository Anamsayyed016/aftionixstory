"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  authzToActionError,
  requireStoryOwnership,
  requireWritingRuleOwnership,
} from "@/lib/auth/authorization";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  createWritingRuleSchema,
  updateWritingRuleSchema,
} from "@/lib/validations/story";

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
  revalidatePath(`/stories/${storyId}/edit`);
  revalidatePath("/dashboard");
}

export async function createWritingRuleAction(
  storyId: string,
  input: unknown
): Promise<ActionResult<{ ruleId: string }>> {
  try {
    const { story } = await requireStoryOwnership(storyId);
    const parsed = createWritingRuleSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const rule = await prisma.writingRule.create({
      data: {
        storyId: story.id,
        ...parsed.data,
      },
    });

    revalidateStory(story.id);
    return ok({ ruleId: rule.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function updateWritingRuleAction(
  ruleId: string,
  input: unknown
): Promise<ActionResult<{ ruleId: string }>> {
  try {
    const { writingRule } = await requireWritingRuleOwnership(ruleId);
    const parsed = updateWritingRuleSchema.safeParse(input);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    await prisma.writingRule.update({
      where: { id: writingRule.id },
      data: parsed.data,
    });

    revalidateStory(writingRule.storyId);
    return ok({ ruleId: writingRule.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}

export async function deleteWritingRuleAction(
  ruleId: string
): Promise<ActionResult<{ ruleId: string }>> {
  try {
    const { writingRule } = await requireWritingRuleOwnership(ruleId);
    await prisma.writingRule.delete({ where: { id: writingRule.id } });
    revalidateStory(writingRule.storyId);
    return ok({ ruleId: writingRule.id });
  } catch (error) {
    const mapped = authzToActionError(error);
    return fail(mapped.code, mapped.message);
  }
}
