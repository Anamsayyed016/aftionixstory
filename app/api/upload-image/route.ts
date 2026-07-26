import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { saveGeneratedImage } from "@/lib/image-agent";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Only JPG, PNG, or WEBP images are supported." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Images must be 8MB or smaller." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await saveGeneratedImage({
      buffer,
      kind: "upload",
      entityId: userId,
      extension,
    });
    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json(
      { error: "Couldn't upload that image. Please try again." },
      { status: 500 }
    );
  }
}
