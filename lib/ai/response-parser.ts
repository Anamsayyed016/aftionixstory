import { AIError } from "@/lib/ai/errors";

const TITLE_MARKERS = [
  /^title\s*:\s*(.+)$/im,
  /^#\s+(.+)$/m,
  /^\*\*(.+)\*\*$/m,
];

export type ParsedEpisodeOutput = {
  title: string;
  content: string;
};

export function assertNonEmptyText(text: string | null | undefined): string {
  const value = (text ?? "").trim();
  if (!value) {
    throw new AIError(
      "AI_INVALID_RESPONSE",
      "The AI provider returned an empty response.",
      false
    );
  }
  return value;
}

/**
 * Extract optional title prefix from model output.
 * Remaining body becomes episode content.
 */
export function parseEpisodeOutput(
  raw: string,
  fallbackTitle: string
): ParsedEpisodeOutput {
  const text = assertNonEmptyText(raw);

  for (const marker of TITLE_MARKERS) {
    const match = text.match(marker);
    if (match?.[1]) {
      const title = match[1].trim().slice(0, 160);
      const content = text.replace(match[0], "").trim();
      if (content.length > 0) {
        return { title: title || fallbackTitle, content };
      }
    }
  }

  // First non-empty line as title if short enough
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0].length <= 80 && !lines[0].includes(". ")) {
    return {
      title: lines[0].replace(/^["']|["']$/g, ""),
      content: lines.slice(1).join("\n\n").trim() || text,
    };
  }

  return {
    title: fallbackTitle,
    content: text,
  };
}

export function parseSummaryOutput(raw: string): string {
  return assertNonEmptyText(raw).slice(0, 4000);
}
