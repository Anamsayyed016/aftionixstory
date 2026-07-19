import type {
  ContinueConversationState,
  CreateConversationState,
} from "@/lib/validations/conversation";

const TITLE_MAX = 72;

export function truncateTitle(text: string, max = TITLE_MAX): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function titleFromCreateMessage(content: string | null | undefined): string {
  const cleaned = (content ?? "").trim();
  if (!cleaned) return "New story idea";
  return truncateTitle(cleaned);
}

export function titleFromContinueStory(
  storyTitle: string | null | undefined,
  instruction?: string | null
): string {
  const base = `Continue: ${storyTitle?.trim() || "Story"}`;
  const excerpt = (instruction ?? "").trim();
  if (!excerpt) return truncateTitle(base);
  return truncateTitle(`${base} — ${excerpt}`);
}

export function emptyCreateState(): CreateConversationState {
  return {
    extractionStatus: "needs_more_info",
    missing: [],
  };
}

export function emptyContinueState(): ContinueConversationState {
  return {
    draft: null,
    draftDirty: false,
  };
}

export function clearContinueDraft(
  state: ContinueConversationState | null | undefined,
  savedEpisodeId?: string
): ContinueConversationState {
  return {
    instruction: state?.instruction,
    draft: null,
    draftDirty: false,
    draftSavedEpisodeId: savedEpisodeId ?? state?.draftSavedEpisodeId,
  };
}

export function previewFromContent(content: string, max = 80): string {
  return truncateTitle(content.replace(/\s+/g, " "), max);
}
