import { notFound } from "next/navigation";
import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { getOwnedStoryDetail } from "@/lib/data/stories";
import {
  StoryWizard,
  createInitialWizardState,
  type WizardState,
} from "@/components/app/story-wizard";

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const user = await requireUser();
  const { storyId } = await params;
  const story = await getOwnedStoryDetail(user.id, storyId);
  if (!story) notFound();

  const initialState: WizardState = createInitialWizardState({
    title: story.title,
    description: story.description || "",
    genre: story.genre,
    language: story.language,
    storyType: story.storyType || "",
    visibility: story.visibility,
    writingStyle: story.writingStyle || "",
    dialogueStyle: story.dialogueStyle || "",
    pointOfView: story.pointOfView || "",
    episodeLength: story.episodeLength || "",
    tone: story.tone || "",
    romanceLevel: story.romanceLevel || "",
    pacing: story.pacing || "",
    customInstructions: story.customInstructions || "",
    setting: story.setting || "",
    timePeriod: story.timePeriod || "",
    mainConflict: story.mainConflict || "",
    initialPlot: story.initialPlot || "",
    worldRules: story.worldRules || "",
    contentBoundaries: story.contentBoundaries || "",
    characters: story.characters.map((c) => ({
      clientId: c.id,
      name: c.name,
      age: c.age != null ? String(c.age) : "",
      gender: c.gender || "",
      role: c.role,
      personality: c.personality,
      appearance: c.appearance || "",
      background: c.background || "",
      speakingStyle: c.speakingStyle || "",
      secrets: c.secrets || "",
      emotionalState: c.emotionalState || "",
    })),
    relationships: story.relationships.map((r) => ({
      clientId: r.id,
      sourceClientId: r.sourceCharacterId,
      targetClientId: r.targetCharacterId,
      relationshipType: r.relationshipType,
      description: r.description || "",
      currentStatus: r.currentStatus || "",
      emotionalDynamic: r.emotionalDynamic || "",
    })),
    writingRules: story.writingRules.map((r) => ({
      clientId: r.id,
      rule: r.rule,
      category: r.category || "",
      priority: r.priority,
      isActive: r.isActive,
    })),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
            Edit
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            {story.title}
          </h2>
        </div>
        <Link
          href={`/stories/${story.id}`}
          className="text-sm text-lilac hover:underline"
        >
          Back to workspace
        </Link>
      </div>
      <StoryWizard mode="edit" storyId={story.id} initialState={initialState} />
    </div>
  );
}
