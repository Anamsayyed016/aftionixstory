/**
 * Enrich user turns that include an attached image so the model cannot
 * ignore the attachment (providers are text-only today — URL + instruction).
 */

export function isBareImageShareMessage(message: string): boolean {
  const t = message.trim();
  return (
    t.length === 0 ||
    /^shared an image\.?$/i.test(t) ||
    /^\[?image( attached)?\]?\.?$/i.test(t)
  );
}

export function buildMessageWithAttachedImage(params: {
  message: string;
  imageUrl: string;
}): string {
  const url = params.imageUrl.trim();
  const text = params.message.trim();

  if (isBareImageShareMessage(text)) {
    return [
      "I shared an image with you (attached).",
      `Image URL: ${url}`,
      "",
      "Please acknowledge that you received my image. Briefly say you can see I shared a picture, then ask how I want to use it — for example as story inspiration, a character look, a scene mood, or something else. Do not ignore the attachment or reply as if only plain text was sent.",
    ].join("\n");
  }

  return [
    text,
    "",
    `[Attached image URL: ${url}]`,
    "Acknowledge the attached image in your reply and use it as context for what I asked.",
  ].join("\n");
}
