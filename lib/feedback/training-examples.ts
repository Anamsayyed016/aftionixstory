import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Consent-controlled feedback / future training examples.
 * Default consent is false — nothing is exportable without explicit opt-in.
 * Stores under .data/ (gitignored) — not a Prisma migration.
 */

export type FeedbackRating =
  | "helpful"
  | "not_helpful"
  | "too_formal"
  | "not_natural_hinglish"
  | "accepted_rewrite";

export type FeedbackExample = {
  id: string;
  userId: string;
  conversationId: string;
  operation: string;
  rating: FeedbackRating;
  tags: string[];
  consentStatus: "granted" | "denied" | "revoked";
  provider?: string;
  model?: string;
  /** Redacted short snapshots only — never full secrets/prompts. */
  inputSummary?: string;
  outputSummary?: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "feedback-examples.jsonl");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function recordFeedbackExample(
  example: Omit<FeedbackExample, "id" | "createdAt"> & {
    id?: string;
  }
): Promise<{ stored: boolean; reason: string }> {
  if (example.consentStatus !== "granted") {
    return { stored: false, reason: "consent_required" };
  }

  await ensureDir();
  const row: FeedbackExample = {
    id:
      example.id ||
      `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: example.userId,
    conversationId: example.conversationId,
    operation: example.operation,
    rating: example.rating,
    tags: example.tags ?? [],
    consentStatus: "granted",
    provider: example.provider,
    model: example.model,
    inputSummary: example.inputSummary?.slice(0, 240),
    outputSummary: example.outputSummary?.slice(0, 240),
    createdAt: new Date().toISOString(),
  };

  await fs.appendFile(FILE, `${JSON.stringify(row)}\n`, "utf8");
  return { stored: true, reason: "ok" };
}
