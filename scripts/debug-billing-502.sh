#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
ACTIVE="$(cat .deploy-active 2>/dev/null || echo blue)"
echo "ACTIVE=${ACTIVE}"
docker compose logs --tail=100 "web_${ACTIVE}" 2>&1 | grep -E 'billing|razorpay|Validation|BAD_REQUEST|create-subscription|error' -i | tail -50
echo "=== last 40 lines ==="
docker compose logs --tail=40 "web_${ACTIVE}" 2>&1
echo "=== plans in env ==="
grep -E '^RAZORPAY_PLAN_|^RAZORPAY_KEY_ID=' .env | sed -E 's/(SECRET|KEY_SECRET)=.*/\1=set/' | sed -E 's/(ID=)(.{8}).*/\1\2…/'
