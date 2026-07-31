import "server-only";

import { promises as fs, existsSync, accessSync, constants } from "fs";
import path from "path";

/**
 * Shared Docker volume path (mounted for both web_blue/web_green in
 * docker-compose.yml) so generated images survive redeploys and are visible
 * to whichever blue/green slot serves the request. Falls back to a local
 * public/ dir for non-Docker dev, where no such volume exists.
 *
 * Override with UPLOADS_DIR when process.cwd() is ambiguous (e.g. monorepo
 * Turbopack picking a parent lockfile root).
 */
const DOCKER_UPLOADS_DIR = "/app/public/uploads/images";

export type ImageStorageErrorCode =
  | "STORAGE_PATH_NOT_WRITABLE"
  | "STORAGE_MKDIR_FAILED"
  | "STORAGE_WRITE_FAILED";

export class ImageStorageError extends Error {
  readonly code: ImageStorageErrorCode;
  readonly pathTried: string;

  constructor(
    code: ImageStorageErrorCode,
    message: string,
    pathTried: string,
    cause?: unknown
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "ImageStorageError";
    this.code = code;
    this.pathTried = pathTried;
  }
}

function localUploadCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "public", "uploads", "images"),
    // Turbopack may treat the monorepo parent as cwd/root while the app lives here.
    path.join(cwd, "storyverse-ai", "public", "uploads", "images"),
  ];
}

/** Exported for tests. */
export function resolveUploadsDir(): string {
  const fromEnv = (process.env.UPLOADS_DIR || "").trim();
  if (fromEnv) return fromEnv;

  if (existsSync("/app/public")) {
    return DOCKER_UPLOADS_DIR;
  }

  for (const candidate of localUploadCandidates()) {
    const publicDir = path.dirname(path.dirname(candidate)); // .../public
    if (existsSync(publicDir)) {
      return candidate;
    }
  }

  return localUploadCandidates()[0];
}

async function assertWritableDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    throw new ImageStorageError(
      "STORAGE_MKDIR_FAILED",
      `Could not create upload directory: ${dir}`,
      dir,
      error
    );
  }

  try {
    accessSync(dir, constants.W_OK);
  } catch (error) {
    throw new ImageStorageError(
      "STORAGE_PATH_NOT_WRITABLE",
      `Upload directory is not writable: ${dir}`,
      dir,
      error
    );
  }

  // Prove write access with a throwaway probe (avoids false positives on some mounts).
  const probe = path.join(dir, `.write-probe-${process.pid}`);
  try {
    await fs.writeFile(probe, "");
    await fs.unlink(probe);
  } catch (error) {
    throw new ImageStorageError(
      "STORAGE_PATH_NOT_WRITABLE",
      `Upload directory failed write probe: ${dir}`,
      dir,
      error
    );
  }
}

export async function saveGeneratedImage(params: {
  buffer: Buffer;
  kind: "avatar" | "cover" | "chat" | "upload";
  entityId: string;
  /** Override the written extension (default png); uploads keep their original type. */
  extension?: string;
}): Promise<string> {
  const dir = resolveUploadsDir();
  await assertWritableDir(dir);

  const ext = params.extension ?? "png";
  const safeEntity = params.entityId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
  const filename = `${params.kind}-${safeEntity}-${Date.now()}.${ext}`;
  const fullPath = path.join(dir, filename);

  try {
    await fs.writeFile(fullPath, params.buffer);
  } catch (error) {
    throw new ImageStorageError(
      "STORAGE_WRITE_FAILED",
      `Failed to write uploaded image to ${fullPath}`,
      fullPath,
      error
    );
  }

  // Served by /api/media/[filename] so Docker volume / standalone runtime
  // writes are always reachable (static public/ serving is unreliable here).
  return `/api/media/${filename}`;
}
