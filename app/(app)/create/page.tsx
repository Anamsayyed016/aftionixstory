import { redirect } from "next/navigation";

import { sanitizeStarterPrompt } from "@/lib/create/story-starters";

/**
 * Create now lives on the chat home. Kept as a redirect (not deleted) so any
 * existing bookmarks/links to /create still land somewhere useful, with the
 * starter prompt preserved.
 */
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawPrompt = Array.isArray(params.prompt) ? params.prompt[0] : params.prompt;
  const prompt = sanitizeStarterPrompt(rawPrompt);
  redirect(prompt ? `/dashboard?prompt=${encodeURIComponent(prompt)}` : "/home");
}
