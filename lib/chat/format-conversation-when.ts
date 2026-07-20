/**
 * Hydration-safe conversation timestamps.
 * Initial SSR + first client render must use the same formatter.
 */

/** Stable label for SSR and the first client paint (UTC, en-US). */
export function formatConversationWhenUtc(iso: string): string {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
    return `${formatted} UTC`;
  } catch {
    return iso.slice(0, 16);
  }
}

/** Local timezone label — only call after mount. */
export function formatConversationWhenLocal(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return formatConversationWhenUtc(iso);
  }
}
