"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

export function StoryCover({
  storyId,
  initialCoverImageUrl,
}: {
  storyId: string;
  initialCoverImageUrl: string | null;
}) {
  const [coverImageUrl, setCoverImageUrl] = React.useState(initialCoverImageUrl);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function generateCover() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        setError(data.error || "Couldn't generate a cover. Please try again.");
        return;
      }
      setCoverImageUrl(data.imageUrl);
    } catch {
      setError("Couldn't generate a cover. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-md border border-border bg-charcoal">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt="Story cover"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center font-mono text-[10px] text-ink-faint">
            No cover yet
          </div>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        loading={generating}
        onClick={generateCover}
      >
        {coverImageUrl ? "Regenerate cover" : "Generate cover"}
      </Button>
      {error && <p className="max-w-[8rem] text-xs text-danger">{error}</p>}
    </div>
  );
}
