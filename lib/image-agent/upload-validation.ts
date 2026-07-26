/** Shared upload validation (no server-only / auth deps). */

export const UPLOAD_ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export type UploadValidationOk = {
  ok: true;
  extension: string;
};

export type UploadValidationErr = {
  ok: false;
  status: 400;
  error: string;
};

export function validateUploadFile(params: {
  mime: string;
  size: number;
}): UploadValidationOk | UploadValidationErr {
  const extension = UPLOAD_ALLOWED_TYPES[params.mime];
  if (!extension) {
    return {
      ok: false,
      status: 400,
      error: "Only JPG, PNG, or WEBP images are supported.",
    };
  }
  if (params.size > UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      status: 400,
      error: "Images must be 8MB or smaller.",
    };
  }
  if (params.size <= 0) {
    return { ok: false, status: 400, error: "Empty file." };
  }
  return { ok: true, extension };
}

export function clientMessageForStorageCode(
  code: "STORAGE_PATH_NOT_WRITABLE" | "STORAGE_MKDIR_FAILED" | "STORAGE_WRITE_FAILED"
): string {
  if (code === "STORAGE_PATH_NOT_WRITABLE" || code === "STORAGE_MKDIR_FAILED") {
    return "Image storage isn't available right now. Please try again later.";
  }
  return "Couldn't save that image. Please try again.";
}
