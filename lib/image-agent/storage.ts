import "server-only";

import { promises as fs, existsSync } from "fs";
import path from "path";

/**
 * Shared Docker volume path (mounted for both web_blue/web_green in
 * docker-compose.yml) so generated images survive redeploys and are visible
 * to whichever blue/green slot serves the request. Falls back to a local
 * public/ dir for non-Docker dev, where no such volume exists.
 */
const DOCKER_UPLOADS_DIR = "/app/public/uploads/images";
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "images");

function resolveUploadsDir(): string {
  return existsSync("/app/public") ? DOCKER_UPLOADS_DIR : LOCAL_UPLOADS_DIR;
}

export async function saveGeneratedImage(params: {
  buffer: Buffer;
  kind: "avatar" | "cover";
  entityId: string;
}): Promise<string> {
  const dir = resolveUploadsDir();
  await fs.mkdir(dir, { recursive: true });

  const filename = `${params.kind}-${params.entityId}-${Date.now()}.png`;
  await fs.writeFile(path.join(dir, filename), params.buffer);

  return `/uploads/images/${filename}`;
}
