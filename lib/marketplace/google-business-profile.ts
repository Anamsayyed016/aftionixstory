/**
 * Guided (manual) Google Business Profile assist — not an API integration.
 */

export const GOOGLE_BUSINESS_PROFILE_CREATE_URL =
  "https://business.google.com/create";

export type BusinessDetailsForGbp = {
  name: string;
  category?: string | null;
  location?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export function formatBusinessDetailsForClipboard(
  business: BusinessDetailsForGbp
): string {
  const lines = [`Name: ${business.name.trim()}`];
  if (business.category?.trim()) {
    lines.push(`Category: ${business.category.trim()}`);
  }
  if (business.location?.trim()) {
    lines.push(`Location: ${business.location.trim()}`);
  }
  if (business.contactPhone?.trim()) {
    lines.push(`Phone: ${business.contactPhone.trim()}`);
  }
  if (business.contactEmail?.trim()) {
    lines.push(`Email: ${business.contactEmail.trim()}`);
  }
  return lines.join("\n");
}

export function gbpNudgeStorageKey(businessId: string): string {
  return `gbp-nudge-dismissed:${businessId}`;
}

/** Prompt used by the chat suggestion chip. */
export const GBP_CHAT_PROMPT = "Help me list on Google Maps";

export function isGbpAssistPrompt(message: string): boolean {
  return /help me list on google maps/i.test(message.trim());
}
