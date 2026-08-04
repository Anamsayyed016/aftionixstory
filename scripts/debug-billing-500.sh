#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
ACTIVE="$(cat .deploy-active 2>/dev/null || echo blue)"
echo "ACTIVE=${ACTIVE}"
echo "=== recent logs ==="
docker compose logs --tail=120 "web_${ACTIVE}" 2>&1 | tail -120
echo "=== migration table ==="
set -a; source ./.env; set +a
docker run --rm --network storyverse-ai_default -e DATABASE_URL -v "$PWD/prisma:/prisma" -w /tmp node:22-alpine \
  sh -lc 'npm install prisma@6.19.3 >/dev/null 2>&1 && npx prisma migrate status --schema=/prisma/schema.prisma' 2>&1 | tail -40
echo "=== subscription table? ==="
docker compose exec -T db psql -U storyverse -d storyverse -c "\dt \"Subscription\"" 2>&1 || true
docker compose exec -T db psql -U storyverse -d storyverse -c "SELECT to_regclass('public.\"Subscription\"');" 2>&1 || true
echo "=== razorpay env present ==="
grep -E '^RAZORPAY_' .env | sed -E 's/(=).*/\1set/'
docker exec "storyverse-ai-${ACTIVE}" printenv | grep -E '^RAZORPAY_' | sed -E 's/(=).*/\1set/' || true
