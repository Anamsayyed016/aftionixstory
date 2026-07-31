/**
 * Keyword + location matching for v1 (no ML).
 */

export type MatchableGig = {
  id: string;
  title: string;
  description: string;
  skillNeeded: string | null;
  category: string | null;
  location: string | null;
};

export type MatchableFreelancer = {
  id: string;
  slug: string;
  summary: string | null;
  skills: string[];
  location: string | null;
  availability: string | null;
};

export type MatchScore = {
  id: string;
  score: number;
  reasons: string[];
};

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function locationCompatible(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const la = (a || "").trim().toLowerCase();
  const lb = (b || "").trim().toLowerCase();
  if (!la || !lb) return true;
  if (la === "remote" || lb === "remote") return true;
  if (la.includes(lb) || lb.includes(la)) return true;
  return false;
}

export function scoreGigFreelancerMatch(
  gig: MatchableGig,
  freelancer: MatchableFreelancer
): MatchScore {
  const reasons: string[] = [];
  let score = 0;

  const gigBlob = [
    gig.title,
    gig.description,
    gig.skillNeeded || "",
    gig.category || "",
  ].join(" ");
  const gigTokens = new Set(tokens(gigBlob));
  const skillTokens = freelancer.skills.flatMap((s) => tokens(s));
  const summaryTokens = tokens(freelancer.summary || "");

  let skillHits = 0;
  for (const s of skillTokens) {
    if (gigTokens.has(s)) {
      skillHits += 1;
      score += 3;
    }
  }
  if (skillHits > 0) {
    reasons.push(`skills_overlap:${skillHits}`);
  }

  if (gig.skillNeeded) {
    const needed = tokens(gig.skillNeeded);
    const hit = needed.some(
      (n) =>
        skillTokens.includes(n) ||
        summaryTokens.includes(n) ||
        freelancer.skills.some((s) => s.toLowerCase().includes(n))
    );
    if (hit) {
      score += 5;
      reasons.push("skill_needed_match");
    }
  }

  if (locationCompatible(gig.location, freelancer.location)) {
    score += 2;
    reasons.push("location_ok");
  } else {
    score -= 4;
    reasons.push("location_mismatch");
  }

  return { id: freelancer.id, score, reasons };
}

export function rankFreelancersForGig(
  gig: MatchableGig,
  freelancers: MatchableFreelancer[],
  limit = 5
): Array<MatchableFreelancer & { score: number; reasons: string[] }> {
  return freelancers
    .map((f) => {
      const m = scoreGigFreelancerMatch(gig, f);
      return { ...f, score: m.score, reasons: m.reasons };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function rankGigsForFreelancer(
  freelancer: MatchableFreelancer,
  gigs: MatchableGig[],
  limit = 5
): Array<MatchableGig & { score: number; reasons: string[] }> {
  return gigs
    .map((g) => {
      const m = scoreGigFreelancerMatch(g, freelancer);
      return { ...g, score: m.score, reasons: m.reasons };
    })
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
