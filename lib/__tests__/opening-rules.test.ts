import { describe, expect, it } from "vitest";

import { shouldAutoStartFromSetup, validateLiveOpening } from "@/lib/story-agent/opening-rules";

describe("opening story rules", () => {
  it("starts the story after contextual setup unless the user explicitly limits it", () => {
    expect(shouldAutoStartFromSetup("Here is the backstory for my romance.")).toBe(true);
    expect(shouldAutoStartFromSetup("Only teaser, please.")).toBe(false);
    expect(shouldAutoStartFromSetup("Write only a prologue.")).toBe(false);
  });

  it("accepts a live Episode 1 opening with scene essentials", () => {
    const draft = `Episode 1\nScene 1\nRiverside Station, morning\nMira stepped onto the platform, clutching the letter.\n\"You came,\" Arjun said.\nShe looked away, hurt but determined. Before he could explain, the train doors opened behind them.`;
    expect(validateLiveOpening(draft)).toEqual([]);
  });
});
