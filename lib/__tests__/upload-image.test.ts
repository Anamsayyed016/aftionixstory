/**
 * Image upload storage + validation (no heavy route/auth imports).
 */

import { mkdtempSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clientMessageForStorageCode,
  validateUploadFile,
} from "@/lib/image-agent/upload-validation";

describe("validateUploadFile", () => {
  it("returns 400 for unsupported type (not 500)", () => {
    const result = validateUploadFile({ mime: "image/gif", size: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/JPG|PNG|WEBP/i);
    }
  });

  it("returns 400 when file is too large", () => {
    const result = validateUploadFile({
      mime: "image/png",
      size: 8 * 1024 * 1024 + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/8MB/i);
    }
  });

  it("accepts a normal PNG", () => {
    const result = validateUploadFile({ mime: "image/png", size: 1200 });
    expect(result).toEqual({ ok: true, extension: "png" });
  });

  it("maps storage codes to specific client messages", () => {
    expect(clientMessageForStorageCode("STORAGE_PATH_NOT_WRITABLE")).toMatch(
      /storage/i
    );
    expect(clientMessageForStorageCode("STORAGE_WRITE_FAILED")).toMatch(
      /save/i
    );
  });
});

describe("saveGeneratedImage", () => {
  const originalUploadsDir = process.env.UPLOADS_DIR;
  let tempRoot: string | null = null;

  afterEach(() => {
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
    if (tempRoot) {
      try {
        rmSync(tempRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      tempRoot = null;
    }
    vi.resetModules();
  });

  it("writes under UPLOADS_DIR and returns a public URL", async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "sv-uploads-"));
    process.env.UPLOADS_DIR = tempRoot;
    const { saveGeneratedImage } = await import("@/lib/image-agent/storage");
    const url = await saveGeneratedImage({
      buffer: Buffer.from([1, 2, 3, 4]),
      kind: "upload",
      entityId: "user_1",
      extension: "png",
    });
    expect(url).toMatch(/^\/uploads\/images\/upload-user_1-\d+\.png$/);
  });

  it("throws STORAGE_* when directory is not writable", async () => {
    tempRoot = mkdtempSync(path.join(tmpdir(), "sv-uploads-ro-"));
    try {
      chmodSync(tempRoot, 0o444);
    } catch {
      return;
    }
    process.env.UPLOADS_DIR = tempRoot;
    const { saveGeneratedImage, ImageStorageError } = await import(
      "@/lib/image-agent/storage"
    );
    try {
      await saveGeneratedImage({
        buffer: Buffer.from([1]),
        kind: "upload",
        entityId: "u",
        extension: "png",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ImageStorageError);
      expect((error as InstanceType<typeof ImageStorageError>).code).toMatch(
        /^STORAGE_/
      );
    } finally {
      try {
        chmodSync(tempRoot, 0o755);
      } catch {
        /* ignore */
      }
    }
  });
});
