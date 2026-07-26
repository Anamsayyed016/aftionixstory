import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  generateCharacterAvatar,
  generateStoryCover,
  isImageGenerationEnabled,
  mapImageAgentError,
} from "@/lib/image-agent";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    characterId: z.string().min(1).optional(),
    storyId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.characterId) !== Boolean(data.storyId), {
    message: "Provide exactly one of characterId or storyId.",
  });

export async function POST(request: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide exactly one of characterId or storyId." },
      { status: 400 }
    );
  }

  try {
    const result = parsed.data.characterId
      ? await generateCharacterAvatar(parsed.data.characterId)
      : await generateStoryCover(parsed.data.storyId as string);
    return NextResponse.json({ imageUrl: result.imageUrl });
  } catch (error) {
    const mapped = mapImageAgentError(error);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
