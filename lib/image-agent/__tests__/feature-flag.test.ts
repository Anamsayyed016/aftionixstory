import { afterEach, describe, expect, it } from "vitest";

import { isImageGenerationEnabled } from "@/lib/image-agent/feature-flag";

describe("isImageGenerationEnabled", () => {
  afterEach(() => {
    delete process.env.IMAGE_GENERATION_ENABLED;
  });

  it("defaults to disabled when unset", () => {
    delete process.env.IMAGE_GENERATION_ENABLED;
    expect(isImageGenerationEnabled()).toBe(false);
  });

  it("is enabled for true/1/yes", () => {
    for (const value of ["true", "1", "yes", "TRUE"]) {
      process.env.IMAGE_GENERATION_ENABLED = value;
      expect(isImageGenerationEnabled()).toBe(true);
    }
  });

  it("is disabled for anything else", () => {
    for (const value of ["false", "0", "no", ""]) {
      process.env.IMAGE_GENERATION_ENABLED = value;
      expect(isImageGenerationEnabled()).toBe(false);
    }
  });
});
