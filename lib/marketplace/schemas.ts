import { z } from "zod";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const businessProfileSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  category: optionalTrimmed,
  location: optionalTrimmed,
  contactEmail: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length === 0 ? undefined : t;
    },
    z.string().email("Enter a valid email").optional()
  ),
  contactPhone: optionalTrimmed,
  summary: optionalTrimmed,
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export const freelancerProfileSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required").max(2000),
  skills: z
    .union([z.array(z.string()), z.string()])
    .transform((v) => {
      const list = Array.isArray(v)
        ? v
        : v.split(/[,;\n]+/);
      return list.map((s) => s.trim()).filter(Boolean).slice(0, 24);
    })
    .pipe(z.array(z.string().min(1).max(60)).min(1, "Add at least one skill")),
  location: optionalTrimmed,
  availability: optionalTrimmed,
  portfolioLinks: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return [] as string[];
      const list = Array.isArray(v) ? v : v.split(/[\n,]+/);
      return list
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s))
        .slice(0, 12);
    }),
  contactEmail: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length === 0 ? undefined : t;
    },
    z.string().email("Enter a valid email").optional()
  ),
  contactPhone: optionalTrimmed,
});

export type FreelancerProfileInput = z.infer<typeof freelancerProfileSchema>;

export const gigPostingSchema = z.object({
  title: z.string().trim().min(1, "Gig title is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(4000),
  skillNeeded: optionalTrimmed,
  category: optionalTrimmed,
  location: optionalTrimmed,
  budget: optionalTrimmed,
});

export type GigPostingInput = z.infer<typeof gigPostingSchema>;

/** Safe internal destinations for marketing → auth callback. */
export function isSafeAppPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/connect") ||
    path.startsWith("/stories") ||
    path.startsWith("/settings") ||
    path.startsWith("/create") ||
    path.startsWith("/admin") ||
    path.startsWith("/b/") ||
    path.startsWith("/f/")
  );
}
