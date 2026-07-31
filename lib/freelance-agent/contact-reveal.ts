/**
 * Contact reveal gating for Freelancer Connect.
 * CRITICAL: contact is only visible when GigMatch.status === ACCEPTED.
 * Pure functions — unit-tested thoroughly; do not bypass in UI/API.
 */

export type GigMatchStatusLike =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "WITHDRAWN";

export type ContactPayload = {
  email: string | null;
  phone: string | null;
};

export type BusinessContactSource = {
  contactEmail: string | null;
  contactPhone: string | null;
};

export type FreelancerContactSource = {
  contactEmail: string | null;
  contactPhone: string | null;
  /** Fallback when freelancer override email is unset. */
  userEmail: string | null;
};

/** True only for mutual acceptance. Never for pending/declined/withdrawn. */
export function canRevealMatchContact(
  status: GigMatchStatusLike | string | null | undefined
): boolean {
  return status === "ACCEPTED";
}

/**
 * Resolve freelancer contact for reveal: optional overrides, else User.email.
 * Phone has no User fallback.
 */
export function resolveFreelancerContact(
  source: FreelancerContactSource
): ContactPayload {
  const email =
    (source.contactEmail && source.contactEmail.trim()) ||
    (source.userEmail && source.userEmail.trim()) ||
    null;
  const phone =
    (source.contactPhone && source.contactPhone.trim()) || null;
  return { email, phone };
}

export function resolveBusinessContact(
  source: BusinessContactSource
): ContactPayload {
  return {
    email: (source.contactEmail && source.contactEmail.trim()) || null,
    phone: (source.contactPhone && source.contactPhone.trim()) || null,
  };
}

/**
 * Returns contacts for both sides only when match is ACCEPTED.
 * Otherwise returns nulls (never leaks).
 */
export function revealContactsForMatch(input: {
  status: GigMatchStatusLike | string | null | undefined;
  business: BusinessContactSource;
  freelancer: FreelancerContactSource;
}): {
  revealed: boolean;
  business: ContactPayload;
  freelancer: ContactPayload;
} {
  if (!canRevealMatchContact(input.status)) {
    return {
      revealed: false,
      business: { email: null, phone: null },
      freelancer: { email: null, phone: null },
    };
  }
  return {
    revealed: true,
    business: resolveBusinessContact(input.business),
    freelancer: resolveFreelancerContact(input.freelancer),
  };
}

/** Public freelancer page must never expose contact — enforce at render. */
export function publicFreelancerViewContact(): ContactPayload {
  return { email: null, phone: null };
}
