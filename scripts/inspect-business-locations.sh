#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
docker compose exec -T db psql -U storyverse -d storyverse <<'SQL'
SELECT COUNT(*) AS total,
       COUNT("verifiedAt") AS verified
FROM "Business";

SELECT name, slug, category, location,
       ("verifiedAt" IS NOT NULL) AS verified
FROM "Business"
ORDER BY "createdAt" DESC
LIMIT 40;
SQL
