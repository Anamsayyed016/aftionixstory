import { SITE } from "@/constants/company/site";
import { isBusinessPubliclyVisible } from "@/lib/marketplace/verification";

/** Canonical public site origin for sitemap / JSON-LD URLs. */
export function publicSiteOrigin(): string {
  return (process.env.AUTH_URL || SITE.url).replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const origin = publicSiteOrigin();
  if (path.startsWith("http")) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isRemoteLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  const n = location.trim().toLowerCase();
  return (
    n === "remote" ||
    n.includes("remote") ||
    n.includes("work from home") ||
    n.includes("wfh") ||
    n === "anywhere"
  );
}

/** Escape text for safe embedding inside HTML / JSON-LD description. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Gig is indexable / public until createdAt + 60 days.
 */
export function gigValidThrough(createdAt: Date): Date {
  const d = new Date(createdAt.getTime());
  d.setUTCDate(d.getUTCDate() + 60);
  return d;
}

/** True when the 60-day JobPosting window has ended. */
export function isGigPastValidThrough(
  createdAt: Date,
  now: Date = new Date()
): boolean {
  return gigValidThrough(createdAt).getTime() < now.getTime();
}

export type PublicGigForJobPosting = {
  id: string;
  title: string;
  description: string;
  skillNeeded: string | null;
  category: string | null;
  location: string | null;
  budget: string | null;
  createdAt: Date;
  business: {
    name: string;
    slug: string;
    location: string | null;
    verifiedAt: Date | null;
  };
};

/**
 * schema.org JobPosting for Google for Jobs.
 * No contact emails/phones. Omits baseSalary (budget is freeform text).
 * Logo uses the platform mark (third-party job board pattern per Google).
 */
export function buildGigJobPostingJsonLd(gig: PublicGigForJobPosting) {
  if (!isBusinessPubliclyVisible(gig.business.verifiedAt)) {
    throw new Error("JobPosting requires a verified business");
  }

  const locationText = gig.location?.trim() || gig.business.location?.trim() || null;
  const remote = isRemoteLocation(locationText);
  const businessUrl = absoluteUrl(`/b/${gig.business.slug}`);
  const gigUrl = absoluteUrl(`/g/${gig.id}`);
  const validThrough = gigValidThrough(gig.createdAt);
  const orgLogo = absoluteUrl("/icon.png");

  const descriptionParts: string[] = [];
  if (remote) {
    descriptionParts.push(
      `<p><strong>This is a 100% remote (TELECOMMUTE) role.</strong> Applicants may work from anywhere in India.</p>`
    );
  }
  descriptionParts.push(`<p>${escapeHtml(gig.description)}</p>`);
  if (gig.skillNeeded) {
    descriptionParts.push(
      `<p><strong>Skill needed:</strong> ${escapeHtml(gig.skillNeeded)}</p>`
    );
  }
  if (gig.category) {
    descriptionParts.push(
      `<p><strong>Category:</strong> ${escapeHtml(gig.category)}</p>`
    );
  }
  if (gig.budget) {
    descriptionParts.push(
      `<p><strong>Budget:</strong> ${escapeHtml(gig.budget)}</p>`
    );
  }
  descriptionParts.push(
    `<p>Apply or express interest via AFTIONIX Freelancer Connect (no contact published on this page).</p>`
  );

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: gig.title,
    description: descriptionParts.join(""),
    datePosted: gig.createdAt.toISOString().slice(0, 10),
    validThrough: validThrough.toISOString(),
    employmentType: "CONTRACTOR",
    identifier: {
      "@type": "PropertyValue",
      name: "AFTIONIX",
      value: gig.id,
    },
    url: gigUrl,
    hiringOrganization: {
      "@type": "Organization",
      name: gig.business.name,
      sameAs: businessUrl,
      logo: orgLogo,
    },
  };

  if (remote) {
    jsonLd.jobLocationType = "TELECOMMUTE";
    jsonLd.applicantLocationRequirements = {
      "@type": "Country",
      name: "IN",
    };
  } else if (locationText) {
    jsonLd.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: locationText,
        addressCountry: "IN",
      },
    };
  } else {
    jsonLd.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "IN",
      },
    };
  }

  return jsonLd;
}
