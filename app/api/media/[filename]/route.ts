import { NextResponse } from "next/server";
import { promises as fs, existsSync } from "fs";
import path from "path";

import { resolveUploadsDir } from "@/lib/image-agent/storage";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Serves uploaded/generated images from the writable uploads directory.
 * Prefer this over relying on Next static `public/` for runtime writes
 * (Docker volume + standalone often 404 static paths even when the file exists).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename: raw } = await context.params;
  const filename = path.basename(raw || "");
  if (!filename || filename !== raw || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  if (!/^(avatar|cover|chat|upload)-[A-Za-z0-9_-]+-\d+\.(png|jpe?g|webp)$/i.test(
    filename
  )) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const dir = resolveUploadsDir();
  const fullPath = path.resolve(dir, filename);
  const relative = path.relative(path.resolve(dir), fullPath);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !existsSync(fullPath)
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(fullPath);
    const ext = filename.split(".").pop()?.toLowerCase() || "png";
    const contentType = MIME[ext] || "application/octet-stream";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
