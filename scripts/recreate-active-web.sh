#!/usr/bin/env bash
set -euo pipefail
cd /var/www/storyverse-ai
ACTIVE="$(cat .deploy-active 2>/dev/null || echo blue)"
echo "ACTIVE=${ACTIVE}"
docker compose up -d --force-recreate --no-deps "web_${ACTIVE}"
PORT=3000
[[ "$ACTIVE" == "green" ]] && PORT=3001
ok=0
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" | grep -q '"ok":true'; then
    ok=1
    curl -fsS "http://127.0.0.1:${PORT}/api/health"
    echo
    break
  fi
  sleep 2
done
[[ "$ok" -eq 1 ]] || { echo "health failed"; exit 1; }
echo "plans/webhook present:"
grep -cE '^RAZORPAY_PLAN_|^RAZORPAY_WEBHOOK_' .env || true
