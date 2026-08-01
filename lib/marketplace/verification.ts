/**
 * Business Directory public visibility.
 * A listing is public at /b/[slug] only when verifiedAt is set.
 * Verification = shopfront contact email matches the owner's account email
 * (credentials or OAuth). No separate OTP flow in v1.
 */

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Returns a Date to store as verifiedAt, or null to clear verification.
 * Preserves an existing verifiedAt timestamp when still valid.
 */
export function resolveBusinessVerifiedAt(input: {
  ownerEmail: string | null | undefined;
  contactEmail: string | null | undefined;
  previousVerifiedAt?: Date | null;
}): Date | null {
  const owner = normalizeEmail(input.ownerEmail);
  const contact = normalizeEmail(input.contactEmail);
  if (!owner || !contact || owner !== contact) {
    return null;
  }
  return input.previousVerifiedAt ?? new Date();
}

export function isBusinessPubliclyVisible(verifiedAt: Date | null | undefined): boolean {
  return verifiedAt != null;
}
