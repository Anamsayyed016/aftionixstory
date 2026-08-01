-- Public shopfront gate: only verified businesses are crawlable at /b/[slug].
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Business_verifiedAt_idx" ON "Business"("verifiedAt");

-- Backfill: existing listings whose contact email matches the owner account
-- are treated as verified (same rule as app verification helper).
UPDATE "Business" AS b
SET "verifiedAt" = COALESCE(b."verifiedAt", b."createdAt")
FROM "User" AS u
WHERE b."ownerUserId" = u.id
  AND b."contactEmail" IS NOT NULL
  AND u.email IS NOT NULL
  AND lower(trim(b."contactEmail")) = lower(trim(u.email))
  AND b."verifiedAt" IS NULL;

-- Idempotent demo listing for marketing OPEN → /b/bright-print-co
-- Password: demo-pass-123 (bcrypt)
INSERT INTO "User" (
  id, email, name, "passwordHash", "emailVerified", "createdAt", "updatedAt", plan
)
VALUES (
  'clseedbizowner00000000001',
  'demo-business@aftionix.example',
  'Demo Business Owner',
  '$2b$10$lsHkASHT0KJ61mjK.G0PeeXqAZqLuJCUIFKwfHq4GzbqHZltnDJQG',
  NOW(),
  NOW(),
  NOW(),
  'FREE'
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name;

WITH owner AS (
  SELECT id FROM "User" WHERE email = 'demo-business@aftionix.example' LIMIT 1
)
INSERT INTO "Business" (
  id,
  "ownerUserId",
  name,
  slug,
  summary,
  category,
  location,
  "contactEmail",
  "contactPhone",
  "verifiedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'clseedbizprint00000000001',
  owner.id,
  'Bright Print Co',
  'bright-print-co',
  'Local printing and branding studio for shops and startups across Pune.',
  'Printing & branding',
  'Pune',
  'demo-business@aftionix.example',
  '+91 98765 43210',
  NOW(),
  NOW(),
  NOW()
FROM owner
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  category = EXCLUDED.category,
  location = EXCLUDED.location,
  "contactEmail" = EXCLUDED."contactEmail",
  "contactPhone" = EXCLUDED."contactPhone",
  "verifiedAt" = COALESCE("Business"."verifiedAt", NOW()),
  "updatedAt" = NOW();
