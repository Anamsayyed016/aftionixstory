import type { NormalizedChatStoryDraft } from "@/lib/chat/create-story-extraction";

export type StoryEssentialKey =
  | "title"
  | "genre"
  | "language"
  | "setting"
  | "tone"
  | "plot"
  | "characters"
  | "style";

export type StoryEssentialChip = {
  key: StoryEssentialKey;
  label: string;
  collected: boolean;
};

const ESSENTIALS: Array<{
  key: StoryEssentialKey;
  label: string;
  test: (draft: NormalizedChatStoryDraft) => boolean;
}> = [
  {
    key: "title",
    label: "Title",
    test: (d) => Boolean(d.title && d.title.trim().length >= 3),
  },
  {
    key: "genre",
    label: "Genre",
    test: (d) => Boolean(d.genre && d.genre.trim().length >= 2),
  },
  {
    key: "language",
    label: "Language",
    test: (d) => Boolean(d.language && d.language.trim().length >= 2),
  },
  {
    key: "setting",
    label: "Setting",
    test: (d) => Boolean(d.setting && d.setting.trim().length >= 2),
  },
  {
    key: "tone",
    label: "Tone",
    test: (d) => Boolean(d.tone && d.tone.trim().length >= 2),
  },
  {
    key: "plot",
    label: "Plot",
    test: (d) => Boolean(d.initialPlot && d.initialPlot.trim().length >= 8),
  },
  {
    key: "characters",
    label: "Main character",
    test: (d) =>
      d.characters.length >= 1 &&
      d.characters.some(
        (c) =>
          c.name.trim().length > 0 &&
          c.role.trim().length > 0 &&
          c.personality.trim().length >= 3
      ),
  },
  {
    key: "style",
    label: "Style",
    test: (d) =>
      Boolean(
        (d.writingStyle && d.writingStyle.trim().length >= 2) ||
          (d.pointOfView && d.pointOfView.trim().length >= 2)
      ),
  },
];

export function getStoryEssentialChips(
  draft: NormalizedChatStoryDraft | null | undefined
): StoryEssentialChip[] {
  if (!draft) {
    return ESSENTIALS.map((item) => ({
      key: item.key,
      label: item.label,
      collected: false,
    }));
  }

  return ESSENTIALS.map((item) => ({
    key: item.key,
    label: item.label,
    collected: item.test(draft),
  }));
}

export function summarizeStoryProgress(
  draft: NormalizedChatStoryDraft | null | undefined
): {
  collected: number;
  total: number;
  chips: StoryEssentialChip[];
  label: string;
} {
  const chips = getStoryEssentialChips(draft);
  const collected = chips.filter((c) => c.collected).length;
  const total = chips.length;
  return {
    collected,
    total,
    chips,
    label: `Story setup: ${collected} of ${total} essentials collected`,
  };
}

/** Open review when extraction becomes complete, or when the user asks. */
export function shouldAutoOpenReview(params: {
  previousStatus: "complete" | "needs_more_info" | null;
  nextStatus: "complete" | "needs_more_info";
}): boolean {
  return (
    params.previousStatus !== "complete" && params.nextStatus === "complete"
  );
}
