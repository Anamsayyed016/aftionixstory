import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { saveGeneratedImage, ImageStorageError } from "@/lib/image-agent/storage";
import {
  clientMessageForStorageCode,
  validateUploadFile,
} from "@/lib/image-agent/upload-validation";

export const dynamic = "force-dynamic";

function asBlobFile(value: FormDataEntryValue | null): Blob | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  ) {
    return value as Blob;
  }
  return null;
}

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const session = await auth();
    userId = session?.user?.id;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "upload_image.auth_failed",
        message: error instanceof Error ? error.message : "auth_error",
      })
    );
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = asBlobFile(formData.get("file"));
  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const mime =
    (typeof File !== "undefined" &&
      "type" in file &&
      typeof (file as File).type === "string" &&
      (file as File).type) ||
    "";

  const validated = validateUploadFile({ mime, size: file.size });
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error },
      { status: validated.status }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await saveGeneratedImage({
      buffer,
      kind: "upload",
      entityId: userId,
      extension: validated.extension,
    });
    return NextResponse.json({ imageUrl });
  } catch (error) {
    if (error instanceof ImageStorageError) {
      console.error(
        JSON.stringify({
          event: "upload_image.storage_failed",
          code: error.code,
          pathTried: error.pathTried,
          message: error.message,
          cause:
            error.cause instanceof Error
              ? error.cause.message
              : error.cause
                ? String(error.cause)
                : undefined,
        })
      );

      return NextResponse.json(
        {
          error: clientMessageForStorageCode(error.code),
          code: error.code,
        },
        { status: 500 }
      );
    }

    console.error(
      JSON.stringify({
        event: "upload_image.unexpected",
        message: error instanceof Error ? error.message : "unknown",
        name: error instanceof Error ? error.name : typeof error,
      })
    );

    return NextResponse.json(
      {
        error: "Couldn't upload that image. Please try again.",
        code: "UPLOAD_FAILED",
      },
      { status: 500 }
    );
  }
}
